"""
Copyright (c) 2021- Equinor ASA

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.

This is a modification of py-expression-eval created by AxiaCore. 

Moifications are done to obtain simplifed functionality for itended usage.

Thanks to AxiaCore!

`py-expression-eval:`

Author: AxiaCore S.A.S. http://axiacore.com
GitHub: https://github.com/AxiaCore/py-expression-eval/

Based on js-expression-eval, by Matthew Crumley (email@matthewcrumley.com, http://silentmatt.com/)
https://github.com/silentmatt/js-expression-eval

Ported to Python and modified by Vera Mazhuga (ctrl-alt-delete@live.com, http://vero4ka.info/)

You are free to use and modify this code in anyway you find useful. Please leave this comment
in the code to acknowledge its original source. If you feel like it, I enjoy hearing about
projects that use my code, but don't feel like you have to let me know or ask permission.
"""
# pylint: skip-file

from __future__ import division

import re

import numpy as np

TNUMBER = 0
TOP1 = 1
TOP2 = 2
TVAR = 3
TFUNCALL = 4


class Token:
    def __init__(self, type_, index_, prio_, number_):
        self.type_ = type_
        self.index_ = index_ or 0
        self.prio_ = prio_ or 0
        self.number_ = number_ if number_ != None else 0

    def toString(self):
        if self.type_ == TNUMBER:
            return self.number_
        if self.type_ == TOP1 or self.type_ == TOP2 or self.type_ == TVAR:
            return self.index_
        elif self.type_ == TFUNCALL:
            return "CALL"
        else:
            return "Invalid Token"


class Expression:
    """
    Expression based on Expression in py_expression_eval, modifications are done.

    `Adjustments:`
    Removed unused functionality as simplify, substitute and toString conversion.

    Removed possibility to assign functions to variables during evaluate(). Thereby variables
    function is simplified as well.

    `Removed functions:`

    - simplify()
    - substitute()
    - toString()
    - symbols()

    `Adjusted functions:`

    - variables() - As functions does not exist, previous symbols function is equal variables
    """

    def __init__(self, tokens, ops1, ops2):
        self.tokens = tokens
        self.ops1 = ops1
        self.ops2 = ops2

    def evaluate(self, values):
        values = values or {}
        nstack = []
        L = len(self.tokens)
        for item in self.tokens:
            type_ = item.type_
            if type_ == TNUMBER:
                nstack.append(item.number_)
            elif type_ == TOP2:
                n2 = nstack.pop()
                n1 = nstack.pop()
                f = self.ops2[item.index_]
                nstack.append(f(n1, n2))
            elif type_ == TVAR:
                if item.index_ in values:
                    nstack.append(values[item.index_])
                else:
                    raise Exception("undefined variable: " + item.index_)
            elif type_ == TOP1:
                n1 = nstack.pop()
                f = self.ops1[item.index_]
                nstack.append(f(n1))
            elif type_ == TFUNCALL:
                n1 = nstack.pop()
                f = nstack.pop()
                if callable(f):
                    if type(n1) is list:
                        nstack.append(f(*n1))
                    else:
                        nstack.append(f(n1))
                else:
                    raise Exception(f + " is not a function")
            else:
                raise Exception("invalid Expression")
        if len(nstack) > 1:
            raise Exception("invalid Expression (parity)")
        return nstack[0]

    def variables(self):
        variables = []
        for i in range(0, len(self.tokens)):
            item = self.tokens[i]
            if item.type_ == TVAR and not item.index_ in variables:
                variables.append(item.index_)
        return variables


class Parser:
    """
    Expression parser based on py_expression_eval, modifications are done.

    `Adjustments:`
    The set of self.ops1 and self.ops2 is adjusted - reduced number of operators and assigned
    numpy-functions to handle array values for variables in Expression.evaluate().

    Removed handling of comma, string input and logical operators.

    Removed self.functions dict, as the keys were handled as variables during expression parsing.
    All functions are placed in self.ops1.

    Removed self.LPAREN "(" as expected next character for isVar()-check in parse() function. This
    is to prevent expressions as "a(b)" which fails when evaluating with vector data for a and b.
    Thereby consistency between Parser.parse() and Expression.evaluate() is kept.

    `Removed functions:`

    - isComma()
    - isString()  - including unescape() function
    - isLogicalNot()

    `Adjusted functions:`

    - isOperator() - reduced number of operators according to self.ops2 items
    - functions moved into ops2 as members of self.functions are handled as variables
    and will be assigned during evaluate()

    """

    PRIMARY = 1
    OPERATOR = 2
    FUNCTION = 4
    LPAREN = 8
    RPAREN = 16
    SIGN = 32
    CALL = 64
    NULLARY_CALL = 128

    def __init__(self, string_literal_quotes=("'", '"')):
        self.string_literal_quotes = string_literal_quotes

        self.success = False
        self.errormsg = ""
        self.expression = ""

        self.pos = 0

        self.tokennumber = 0
        self.tokenprio = 0
        self.tokenindex = 0
        self.tmpprio = 0

        # Note: All functions should be in self.ops1 as items are handled as functions
        self.ops1 = {
            "sqrt": np.sqrt,
            "abs": np.abs,
            "-": np.negative,
            "ln": np.log,  # Natural logarithm
            "log10": np.log10,  # Base-10 logarithm
        }

        self.ops2 = {
            "+": np.add,
            "-": np.subtract,
            "*": np.multiply,
            "/": np.divide,
            "%": np.mod,
            "^": np.power,
            "**": np.power,
        }

        self.consts = {
            "E": np.e,
            "PI": np.pi,
        }

    def parse(self, expr):
        self.errormsg = ""
        self.success = True
        operstack = []
        tokenstack = []
        self.tmpprio = 0
        expected = self.PRIMARY | self.LPAREN | self.FUNCTION | self.SIGN
        noperators = 0
        self.expression = expr
        self.pos = 0

        while self.pos < len(self.expression):
            if self.isOperator():
                if self.isSign() and expected & self.SIGN:
                    if self.isNegativeSign():
                        self.tokenprio = 5
                        self.tokenindex = "-"
                        noperators += 1
                        self.addfunc(tokenstack, operstack, TOP1)
                    expected = self.PRIMARY | self.LPAREN | self.FUNCTION | self.SIGN
                else:
                    if expected and self.OPERATOR == 0:
                        self.error_parsing(self.pos, "unexpected operator")
                    noperators += 2
                    self.addfunc(tokenstack, operstack, TOP2)
                    expected = self.PRIMARY | self.LPAREN | self.FUNCTION | self.SIGN
            elif self.isNumber():
                if expected and self.PRIMARY == 0:
                    self.error_parsing(self.pos, "unexpected number")
                token = Token(TNUMBER, 0, 0, self.tokennumber)
                tokenstack.append(token)
                expected = self.OPERATOR | self.RPAREN
            elif self.isLeftParenth():
                if (expected & self.LPAREN) == 0:
                    self.error_parsing(self.pos, 'unexpected "("')
                if expected & self.CALL:
                    noperators += 2
                    self.tokenprio = -2
                    self.tokenindex = -1
                    self.addfunc(tokenstack, operstack, TFUNCALL)
                expected = (
                    self.PRIMARY
                    | self.LPAREN
                    | self.FUNCTION
                    | self.SIGN
                    | self.NULLARY_CALL
                )
            elif self.isRightParenth():
                if expected & self.NULLARY_CALL:
                    token = Token(TNUMBER, 0, 0, [])
                    tokenstack.append(token)
                elif (expected & self.RPAREN) == 0:
                    self.error_parsing(self.pos, 'unexpected ")"')
                expected = self.OPERATOR | self.RPAREN | self.LPAREN | self.CALL
            elif self.isConst():
                if (expected & self.PRIMARY) == 0:
                    self.error_parsing(self.pos, "unexpected constant")
                consttoken = Token(TNUMBER, 0, 0, self.tokennumber)
                tokenstack.append(consttoken)
                expected = self.OPERATOR | self.RPAREN
            elif self.isOp2():
                if (expected & self.FUNCTION) == 0:
                    self.error_parsing(self.pos, "unexpected function")
                self.addfunc(tokenstack, operstack, TOP2)
                noperators += 2
                expected = self.LPAREN
            elif self.isOp1():
                if (expected & self.FUNCTION) == 0:
                    self.error_parsing(self.pos, "unexpected function")
                self.addfunc(tokenstack, operstack, TOP1)
                noperators += 1
                expected = self.LPAREN
            elif self.isVar():
                if (expected & self.PRIMARY) == 0:
                    self.error_parsing(self.pos, "unexpected variable")
                vartoken = Token(TVAR, self.tokenindex, 0, 0)
                tokenstack.append(vartoken)
                expected = self.OPERATOR | self.RPAREN | self.CALL
            elif self.isWhite():
                pass
            else:
                if self.errormsg == "":
                    self.error_parsing(self.pos, "unknown character")
                else:
                    self.error_parsing(self.pos, self.errormsg)
        if self.tmpprio < 0 or self.tmpprio >= 10:
            self.error_parsing(self.pos, 'unmatched "()"')
        while len(operstack) > 0:
            tmp = operstack.pop()
            tokenstack.append(tmp)
        if (noperators + 1) != len(tokenstack):
            self.error_parsing(self.pos, "parity")

        return Expression(tokenstack, self.ops1, self.ops2)

    def evaluate(self, expr, variables):
        return self.parse(expr).evaluate(variables)

    def error_parsing(self, column, msg):
        self.success = False
        self.errormsg = (
            "parse error [column "
            + str(column)
            + "]: "
            + msg
            + ", expression: "
            + self.expression
        )
        raise Exception(self.errormsg)

    def addfunc(self, tokenstack, operstack, type_):
        operator = Token(
            type_,
            self.tokenindex,
            self.tokenprio + self.tmpprio,
            0,
        )
        while len(operstack) > 0:
            if operator.prio_ <= operstack[len(operstack) - 1].prio_:
                tokenstack.append(operstack.pop())
            else:
                break
        operstack.append(operator)

    def isNumber(self):
        r = False

        if self.expression[self.pos] == "E":
            return False

        # number in scientific notation
        pattern = r"([-+]?([0-9]*\.?[0-9]*)[eE][-+]?[0-9]+).*"
        match = re.match(pattern, self.expression[self.pos :])
        if match:
            self.pos += len(match.group(1))
            self.tokennumber = float(match.group(1))
            return True

        # number in decimal
        str = ""
        while self.pos < len(self.expression):
            code = self.expression[self.pos]
            if (code >= "0" and code <= "9") or code == ".":
                if len(str) == 0 and code == ".":
                    str = "0"
                str += code
                self.pos += 1
                try:
                    self.tokennumber = int(str)
                except ValueError:
                    self.tokennumber = float(str)
                r = True
            else:
                break
        return r

    def isConst(self):
        for i in self.consts:
            L = len(i)
            str = self.expression[self.pos : self.pos + L]
            if i == str:
                if len(self.expression) <= self.pos + L:
                    self.tokennumber = self.consts[i]
                    self.pos += L
                    return True
                if (
                    not self.expression[self.pos + L].isalnum()
                    and self.expression[self.pos + L] != "_"
                ):
                    self.tokennumber = self.consts[i]
                    self.pos += L
                    return True
        return False

    def isOperator(self):
        ops = (
            ("**", 8, "**"),
            ("^", 8, "^"),
            ("%", 6, "%"),
            ("/", 6, "/"),
            (u"\u2219", 5, "*"),  # bullet operator
            (u"\u2022", 5, "*"),  # black small circle
            ("*", 5, "*"),
            ("+", 4, "+"),
            ("-", 4, "-"),
        )
        for token, priority, index in ops:
            if self.expression.startswith(token, self.pos):
                self.tokenprio = priority
                self.tokenindex = index
                self.pos += len(token)
                return True
        return False

    def isSign(self):
        code = self.expression[self.pos - 1]
        return (code == "+") or (code == "-")

    def isPositiveSign(self):
        code = self.expression[self.pos - 1]
        return code == "+"

    def isNegativeSign(self):
        code = self.expression[self.pos - 1]
        return code == "-"

    def isLeftParenth(self):
        code = self.expression[self.pos]
        if code == "(":
            self.pos += 1
            self.tmpprio += 10
            return True
        return False

    def isRightParenth(self):
        code = self.expression[self.pos]
        if code == ")":
            self.pos += 1
            self.tmpprio -= 10
            return True
        return False

    def isWhite(self):
        code = self.expression[self.pos]
        if code.isspace():
            self.pos += 1
            return True
        return False

    def isOp1(self):
        str = ""
        for i in range(self.pos, len(self.expression)):
            c = self.expression[i]
            if c.upper() == c.lower():
                if i == self.pos or (c != "_" and (c < "0" or c > "9")):
                    break
            str += c
        if len(str) > 0 and str in self.ops1:
            self.tokenindex = str
            self.tokenprio = 9
            self.pos += len(str)
            return True
        return False

    def isOp2(self):
        str = ""
        for i in range(self.pos, len(self.expression)):
            c = self.expression[i]
            if c.upper() == c.lower():
                if i == self.pos or (c != "_" and (c < "0" or c > "9")):
                    break
            str += c
        if len(str) > 0 and (str in self.ops2):
            self.tokenindex = str
            self.tokenprio = 9
            self.pos += len(str)
            return True
        return False

    def isVar(self):
        str = ""
        for i in range(self.pos, len(self.expression)):
            c = self.expression[i]
            if c.lower() == c.upper() and not (c in "_.") and (c < "0" or c > "9"):
                break
            str += c
        if str:
            self.tokenindex = str
            self.tokenprio = 6
            self.pos += len(str)
            return True
        return False