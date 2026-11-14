"""Regression test: a fresh clone has no backend/data/ folder (it is gitignored); start-up must create it."""
from pathlib import Path

from app.database import Base, make_engine


def test_file_database_folder_is_created_on_first_start(tmpdir_path):
    db_file = Path(tmpdir_path) / "does" / "not" / "exist" / "codebox.db"
    assert not db_file.parent.exists()
    engine = make_engine(f"sqlite:///{db_file.as_posix()}")
    Base.metadata.create_all(engine)
    assert db_file.exists()
