"""Static policy check on submitted source (DS-VAL-01, CEP-F-024).

First line of defence only: it gives users a fast, friendly rejection. The real enforcement is the runtime
audit hook and the Job Object (a static check can always be evaded with enough cleverness).
"""
import ast
from dataclasses import dataclass

BLOCKED_IMPORTS = frozenset({
    "subprocess", "socket", "_socket", "ssl", "http", "urllib", "ftplib", "smtplib", "poplib", "imaplib", "telnetlib",
    "xmlrpc", "socketserver", "requests", "ctypes", "_ctypes", "cffi", "multiprocessing", "signal", "shutil",
    "tempfile", "glob", "sqlite3", "pickle", "marshal", "shelve", "dbm", "importlib", "runpy", "code", "codeop",
    "pty", "fcntl", "mmap", "resource", "webbrowser", "builtins", "gc", "_winapi", "msvcrt", "winreg", "winsound",
    "pdb", "bdb", "trace", "cProfile", "profile", "asyncio", "ensurepip", "venv",
})
BLOCKED_NAMES = frozenset({
    "eval", "exec", "compile", "open", "__import__", "breakpoint", "globals", "vars", "__builtins__", "__loader__",
    "__spec__",
})
BLOCKED_ATTRS = frozenset({
    "__subclasses__", "__globals__", "__builtins__", "__code__", "__bases__", "__mro__", "__closure__", "__loader__",
    "f_globals", "f_locals", "f_builtins", "f_back", "gi_frame", "gi_code", "cr_frame", "cr_code", "ag_frame",
    "tb_frame",
})
REFLECTION_CALLS = frozenset({"getattr", "setattr", "delattr", "hasattr"})


@dataclass
class Verdict:
    ok: bool
    reason: str | None = None
    rule: str | None = None


def _deny(node, rule: str, msg: str) -> Verdict:
    line = getattr(node, "lineno", "?")
    return Verdict(False, f"Line {line}: {msg}", rule)


def validate(source: str) -> Verdict:
    try:
        tree = ast.parse(source, filename="main.py")
    except SyntaxError:
        return Verdict(True)  # let the interpreter report the syntax error with a normal traceback
    except (RecursionError, MemoryError, ValueError) as e:
        return Verdict(False, f"Source could not be analysed safely ({type(e).__name__})", "unparseable")

    try:
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    top = alias.name.split(".")[0]
                    if top in BLOCKED_IMPORTS:
                        return _deny(node, "import", f"import of module '{alias.name}' is not allowed")
            elif isinstance(node, ast.ImportFrom):
                if node.level and node.level > 0:
                    return _deny(node, "import", "relative imports are not allowed")
                top = (node.module or "").split(".")[0]
                if top in BLOCKED_IMPORTS:
                    return _deny(node, "import", f"import from module '{node.module}' is not allowed")
            elif isinstance(node, ast.Name):
                if node.id in BLOCKED_NAMES:
                    return _deny(node, "builtin", f"use of '{node.id}' is not allowed")
            elif isinstance(node, ast.Attribute):
                if node.attr in BLOCKED_ATTRS:
                    return _deny(node, "attribute", f"access to attribute '{node.attr}' is not allowed")
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in REFLECTION_CALLS:
                if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant) and isinstance(node.args[1].value, str):
                    if node.args[1].value.startswith("__"):
                        return _deny(node, "reflection", f"{node.func.id}() with a dunder attribute name is not allowed")
    except RecursionError:
        return Verdict(False, "Source is too deeply nested to analyse safely", "unparseable")
    return Verdict(True)
