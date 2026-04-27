# Product

## Register

product

## Users

**Primary Users**: University students (primarily Arabic-speaking) seeking academic resources, study materials, and AI-assisted learning support.

**Secondary Users**:
- **Instructors**: Creating and managing courses, quizzes, and student progress
- **Admins**: Platform oversight, content moderation, and system configuration

**User Context**: Students study in varied environments—late nights, library sessions, mobile browsing between classes. They need quick access to summaries, course materials, and AI help. The interface must respect their time and cognitive load.

**Jobs to Be Done**:
- Find and download study summaries quickly
- Enroll in courses and track learning progress
- Get AI-assisted explanations for difficult topics
- Take quizzes and assess knowledge
- Access materials on both desktop and mobile

## Product Purpose

Masar X is a comprehensive learning platform that combines crowdsourced academic content, structured courses, and AI-powered assistance into one cohesive educational tool. It bridges the gap between traditional study resources and modern AI-enhanced learning, making quality education accessible and efficient for university students.

Success looks like: students completing courses, contributing summaries, engaging with the AI assistant, and returning consistently as their primary academic resource.

## Brand Personality

**Modern, Intelligent, Seamless**

- **Modern**: Clean interfaces that feel contemporary—not trendy for trendiness sake, but current in the way tools like Linear or Notion feel purposeful and fresh
- **Intelligent**: UI that anticipates needs, surfaces relevant content, and makes the AI assistant feel integrated rather than bolted-on
- **Seamless**: Smooth transitions, consistent patterns, and zero friction between discovery → action → completion

## Anti-references

**Avoid**:
- Cluttered old-school ed-tech ( Moodle, legacy Blackboard, university portals with 50 sidebar items)
- Sterile corporate designs (dry grays, no warmth, bureaucratic density)
- Boring government portals (utilitarian to the point of hostility, no visual hierarchy)
- "Startup template" aesthetics (overused gradient blobs, generic hero sections with stock photos)

**Should feel like**: A high-tech AI-powered tool—more Raycast than SAP, more Notion than Canvas.

## Design Principles

1. **Cognitive respect** — Reduce decision fatigue. Present the right options at the right time. No overwhelming dashboards on first login.

2. **Fluid bilingualism** — Arabic and English should feel equally at home. RTL isn't an afterthought; it's co-equal. Typography choices must honor both scripts.

3. **Purposeful density** — Information-rich when needed (course catalogs, admin dashboards), breathing room when not (reading modes, focus states).

4. **Progressive disclosure** — Surface essentials, hide complexity. Advanced features reveal themselves as users grow into them.

5. **Rest is a feature** — Dark mode isn't just inverted colors; it's calibrated for 2am study sessions. Comfort for extended use matters.

## Accessibility & Inclusion

- **WCAG 2.1 AA** as baseline, with AA+ ambitions for contrast and readability
- **RTL-first typography**: Arabic type hierarchy needs distinct treatment—Almarai font, adjusted line-heights, proper letter-spacing for readability at small sizes
- **Dark mode calibrated for long sessions**: Not just inverted, but tested for reduced eye strain during extended study periods
- **Reduced motion support**: Respect `prefers-reduced-motion` for all animations; no parallax or heavy motion as default
- **Color-blind friendly**: UI states don't rely on color alone (success/failure/pending use icons + color)
- **Mobile accessibility**: Touch targets minimum 44px, readable text at 16px base
