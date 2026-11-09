# EXPECT: RUNTIME_ERROR
import pathlib
pathlib.Path("out.txt").write_text("data")
