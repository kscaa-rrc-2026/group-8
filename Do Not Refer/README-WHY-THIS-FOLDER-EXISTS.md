# Do Not Refer

Everything in this folder is the earlier ERMS scaffold. It is kept for
reference only. **Do not build on it, and do not import from it.**

## Why it was set aside

This is a learning exercise. The five of us are meant to build five pieces of
one system in parallel, each of us doing real design and real implementation on
our own piece.

The scaffold in this folder was a complete, working application. The five
workstream documents split up what was *left over* — a dashboard summary
endpoint here, a category picker there, a file-storage TODO — rather than
splitting up the system itself. Read `docs/workstreams/01-employee.md` in this
folder and look at how short its "What's left" section is. There was very little
left for anyone to learn by building.

So the group agreed to set it aside and start again, dividing the system into
five genuine pieces first, and building each one properly.

## Nothing has been lost

Every file here is intact, and git holds the full history regardless. The
scaffold as it stood is commit `c89da12`. To see it exactly as it was:

    git show c89da12

To bring any single file back:

    git checkout c89da12 -- <path/to/file>

## What was good in it, and worth keeping in mind

The architecture document in this folder is worth reading before the new build
starts. Several of its decisions were sound and the new system should make the
same ones, arrived at deliberately rather than copied:

- Role-based access enforced on the server, never by hiding a button
- An append-only audit log written on every change to a claim
- Maker-checker: nobody may approve their own claim
- Soft deletes — a claim is never truly removed
- Duplicate bill detection before a claim reaches payment

The stack it chose (React, Express, Prisma, PostgreSQL) is a separate question
from those decisions, and the new build is not bound by it.
