---
trigger: always_on
---

The machine we are editing code on is likely not the machine we are testing it on. If provided with error logs, do not blindly assume they are from the localhost. We can discuss the role and locality of machines with the following terms:
localhost - "This" machine, whatever we are running antigravity on, almost certainly it's the "development machine", and could hold additional roles
development machine - The machine which we edit code on, it is usually going to be localhost.
testing machine - The machine we are running a cycle of `git pull && docker compose down && docker compose up -d --build` on after we've committed changes to the repository. It is possible that this machine is also the development machine or the production machine, but this is not guaranteed. If you receive error logs, it is probably safe to assume they came from this machine (but it may be worth confirming)
production machine - The machine we will eventually deploy the running service to. This machine may also be our testing machine, but that is not guaranteed. Machines with this role are the ones we least want to commit bad code to.