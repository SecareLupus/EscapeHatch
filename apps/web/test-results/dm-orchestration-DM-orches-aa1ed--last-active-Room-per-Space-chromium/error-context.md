# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - heading "Skerry Local Chat" [level=1] [ref=e4]
      - generic [ref=e5]:
        - button "Switch to Dark Mode" [ref=e6] [cursor=pointer]: 🌙
        - button "🔍" [ref=e7] [cursor=pointer]
        - link "User Settings" [ref=e8] [cursor=pointer]:
          - /url: /settings
          - text: ⚙️
        - generic [ref=e9]: Offline
        - generic [ref=e10]: Signed in as Guest
    - alert [ref=e11]: "404 Not Found (Target: /auth/providers)"
    - generic [ref=e13]:
      - heading "Skerry" [level=2] [ref=e14]
      - paragraph [ref=e15]: Log in to access your workspace
      - paragraph [ref=e17]: No OAuth providers are enabled.
      - paragraph [ref=e18]: Configure providers in .env
  - alert [ref=e19]
```