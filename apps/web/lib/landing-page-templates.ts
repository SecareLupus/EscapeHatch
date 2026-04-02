export interface LandingPageTemplate {
    id: string;
    name: string;
    html: string;
    css: string;
}

export const LANDING_PAGE_TEMPLATES: LandingPageTemplate[] = [
    {
        id: "community-hub",
        name: "Community Hub",
        html: `<div class="hero">
  <h1>Welcome to {{serverName}}!</h1>
  <p>We are a community of creators, thinkers, and builders.</p>
  <skerry-join-button></skerry-join-button>
</div>

<section class="features">
  <div class="feature">
    <h3>📢 Announcements</h3>
    <p>Stay up to date with the latest news from the hub.</p>
  </div>
  <div class="feature">
    <h3>💬 Discussions</h3>
    <p>Join the conversation in our various topical rooms.</p>
  </div>
</section>`,
        css: `.hero {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--sk-surface);
  border-radius: 1rem;
  border: 1px solid var(--sk-border);
  margin-bottom: 2rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--sk-accent);
}

.features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.feature {
  padding: 1.5rem;
  background: var(--sk-surface);
  border-radius: 0.75rem;
  border: 1px solid var(--sk-border);
}`
    },
    {
        id: "personal-profile",
        name: "Personal Profile",
        html: `<div class="profile-card">
  <div class="avatar-placeholder"></div>
  <h1>{{viewerName}}</h1>
  <p class="bio">Passionate creator exploring the intersection of AI and Art.</p>
  
  <div class="links">
    <a href="#" class="btn">Portfolio</a>
    <a href="#" class="btn secondary">Contact Me</a>
  </div>
</div>`,
        css: `.profile-card {
  max-width: 500px;
  margin: 4rem auto;
  text-align: center;
  padding: 2.5rem;
  background: var(--sk-surface);
  border: 1px solid var(--sk-border);
  border-radius: 1.5rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
}

.avatar-placeholder {
  width: 120px;
  height: 120px;
  background: var(--sk-accent);
  border-radius: 50%;
  margin: 0 auto 1.5rem;
  opacity: 0.8;
}

.bio {
  color: var(--sk-text-muted);
  margin-bottom: 2rem;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: var(--sk-accent);
  color: white;
  text-decoration: none;
  border-radius: 0.5rem;
  font-weight: 600;
  margin: 0.5rem;
}

.btn.secondary {
  background: var(--sk-bg);
  color: var(--sk-text);
  border: 1px solid var(--sk-border);
}`
    },
    {
        id: "announcement-splash",
        name: "Announcement Splash",
        html: `<div class="splash-container">
  <div class="badge">NEW HUB</div>
  <h1>Big things are coming.</h1>
  <p>Join {{serverName}} to be the first to know when we launch.</p>
  <skerry-join-button></skerry-join-button>
</div>`,
        css: `.splash-container {
  height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.badge {
  background: var(--sk-accent);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 2rem;
  font-size: 0.8rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.splash-container h1 {
  font-size: 4rem;
  font-weight: 800;
  margin-bottom: 1rem;
  letter-spacing: -0.02em;
}

.splash-container p {
  font-size: 1.25rem;
  color: var(--sk-text-muted);
  margin-bottom: 2.5rem;
  max-width: 600px;
}`
    }
];
