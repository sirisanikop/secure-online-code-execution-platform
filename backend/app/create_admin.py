"""Create or promote an administrator:  python -m app.create_admin <username> <password>"""
import sys

from .config import Settings
from .database import Base, make_engine, make_session_factory
from .schemas import RegisterIn
from .services import auth_service

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: python -m app.create_admin <username> <password>")
    RegisterIn(username=sys.argv[1], password=sys.argv[2])  # validates the rules
    st = Settings(admin_username=sys.argv[1], admin_password=sys.argv[2])
    engine = make_engine(st.database_url)
    Base.metadata.create_all(engine)
    with make_session_factory(engine)() as db:
        auth_service.ensure_admin(db, st)
    print(f"administrator '{sys.argv[1].lower()}' is ready")
