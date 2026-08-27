# SAMS — Student Attendance Management System

SAMS is a local-network, multi-user web application designed to digitize and manage student attendance in schools.

## Core Goals

- Replace paper-based attendance files.
- Allow multiple teachers to access the system simultaneously over a local network.
- Store attendance centrally in MySQL.
- Provide secure authentication and role-based access.
- Preserve attendance data reliably and prevent unauthorized modifications.
- Generate official attendance sheets and analytical reports.

## Planned Stack

- **Backend:** PHP 8+
- **Database:** MySQL / MariaDB
- **Server:** Apache via XAMPP
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Communication:** Fetch API / JSON

## Architecture

```text
Browser
   ↓
HTML / CSS / JavaScript
   ↓ Fetch API
PHP Application / API
   ↓
MySQL Database
```

## Development Principles

- Database is the source of truth.
- Client-side validation is never treated as security.
- Passwords are stored using PHP password hashing.
- SQL queries use prepared statements.
- Authentication and authorization are enforced server-side.
- Secrets and real school data are never committed to Git.

## Project Status

Initial foundation and architecture setup.

> This repository must not contain real student records, real passwords, or production database credentials.
