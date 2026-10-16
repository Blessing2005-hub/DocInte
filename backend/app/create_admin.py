"""
Creates the first administrator account. Run this once after setting up
the database, before starting the server for real use.

Unlike the original project's create_admin.py, no credentials are
hardcoded in source - you're prompted for them, and the password is
hashed with bcrypt before it's ever written to disk.

Usage:
    cd backend
    python -m app.create_admin
"""
import getpass
import sys

from app.auth import hash_password
from app.database import Department, User, init_db, SessionLocal
from app.services.department_service import find_department


def main():
    init_db()
    db = SessionLocal()

    print("=== Create first administrator account ===")
    ec_number = input("EC number: ").strip()
    username = input("Username: ").strip()
    full_name = input("Full name: ").strip()

    names = [d.name for d in db.query(Department).order_by(Department.name).all()]
    print("\nDepartments:")
    for i, name in enumerate(names, 1):
        print(f"  {i}. {name}")
    choice = input("Department (number or name): ").strip()
    if choice.isdigit() and 1 <= int(choice) <= len(names):
        department = names[int(choice) - 1]
    else:
        department = find_department(db, choice)
    if not department:
        print("That is not one of the listed departments.")
        sys.exit(1)

    if db.query(User).filter((User.ec_number == ec_number) | (User.username == username)).first():
        print("A user with that EC number or username already exists.")
        sys.exit(1)

    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Passwords do not match.")
        sys.exit(1)

    if len(password) < 8:
        print("Password must be at least 8 characters.")
        sys.exit(1)

    user = User(
        ec_number=ec_number,
        username=username,
        full_name=full_name,
        password_hash=hash_password(password),
        role="Admin",
        department=department,
    )
    db.add(user)
    db.commit()

    print(f"\nAdministrator '{username}' created successfully.")


if __name__ == "__main__":
    main()
