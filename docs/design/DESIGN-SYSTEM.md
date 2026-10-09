# SAMS — Design System

Status: Canonical visual system
Source of truth: current implemented semantic tokens + approved Design R&D decisions

## 1. Identity

Visual direction:

# Calm Precision — The Digital School Register

The interface should feel:
- professional;
- calm;
- exact;
- trustworthy;
- efficient;
- human;
- restrained.

## 2. Typography

Current product font:
Inter

Semantic roles:

| Role | Guidance |
| --- | --- |
| Page title | 24–28px, semibold |
| Section title | 18–20px, semibold |
| Body | 15–16px, regular |
| Body emphasis | 15–16px, medium |
| Label | 13–14px, medium |
| Caption | 12–13px, regular |
| Numeric data | tabular figures where compared |

Rules:
- do not use heavy display typography in routine authenticated workflows;
- avoid excessive uppercase;
- preserve Arabic line-height and wrapping;
- use weight and spacing before decorative color for hierarchy.

## 3. Color tokens

These values match the current frontend/src/styles/global.css baseline.

| Token | Value | Usage |
| --- | --- | --- |
| background | #f5f5f5 | application canvas |
| surface | #ffffff | cards/forms/tables/dialogs |
| muted-surface | #f5f5f5 | subtle grouping |
| text | #171717 | primary text |
| muted | #6b6b6b | secondary text |
| border | #d4d4d4 | structural borders |
| action | #171717 | primary action |
| action-hover | #303030 | primary action hover |
| action-foreground | #ffffff | primary action text |
| action-soft | #f5f5f5 | soft selected/action surface |
| focus | #2563eb | keyboard focus |
| danger | #b42318 | error/destructive |
| danger-surface | #fef3f2 | danger background |
| success | #157347 | confirmed success |
| success-surface | #ecfdf3 | success background |
| warning | #a15c00 | caution/pending |
| warning-surface | #fff7e8 | warning background |
| info | #1d4ed8 | information |
| info-surface | #eff6ff | information background |
| excused | #6b4aa6 | excused attendance |
| excused-surface | #f4f0ff | excused attendance background |
| brand-accent | #1d4ed8 | restrained product accent |
| brand-accent-soft | #eff6ff | soft accent surface |

Semantic roles remain semantic. Do not use success green as decoration or danger red as a brand color.

## 4. Color distribution

Default visual ratio:
- mostly neutral surfaces/text;
- small amount of cobalt utility accent;
- semantic colors reserved for state;
- decorative color rare.

Do not introduce page-specific accent palettes.

## 5. Spacing

Use a 4px base rhythm.

Preferred scale:
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48

Guidance:
- 8–12px: closely related controls;
- 16px: internal component spacing;
- 24px: task-group separation;
- 32px+: major page sections.

Prefer predictable spacing over one-off values.

## 6. Shape

Preferred radii:
- 4px: small tags/chips;
- 6px: compact buttons/inputs;
- 8px: compact cards/panels;
- 12px: major containers/dialog surfaces;
- pill only where the shape communicates a semantic category.

The current shared sams-card uses a 12px radius.

Do not make the whole application pill-shaped.

## 7. Surfaces and elevation

Primary rule:

> borders before shadows

Default surfaces use:
- white background;
- one-pixel neutral border;
- minimal shadow.

Higher elevation is reserved for:
- dialogs;
- drawers;
- popovers;
- transient layered interfaces.

New pages should not introduce large floating shadows.

## 8. Layout baseline

Current authenticated app uses:
- application maximum width around 90rem;
- admin large-screen sidebar around 17rem;
- teacher/non-admin sidebar area around 16rem at large layouts;
- admin main content with generous desktop padding;
- mobile/tablet stacked navigation.

Teacher operational screens may use a tighter content max width when it improves attendance density, but must preserve the same shell language.

## 9. Headers and page titles

Use the existing PageHeader pattern where a page fits it.

Typical structure:

~~~text
Eyebrow (optional)
Title
Supporting description
Actions (optional)
~~~

Do not duplicate the page title in a second visual heading without a clear hierarchy reason.

## 10. Buttons

Primary:
- dark ink background;
- white foreground.

Secondary:
- white/light neutral surface;
- neutral border;
- dark readable text.

Destructive:
- semantic danger treatment only when the action is actually destructive.

Rules:
- use text for important actions;
- icon-only controls require accessible names;
- loading must prevent duplicate mutation;
- disabled state must remain perceivable and not look like an error.

## 11. Inputs, search, and selects

Inputs share:
- consistent border;
- consistent focus ring;
- comfortable height;
- readable text;
- associated labels.

Search is a task control, not decorative chrome.

Filters belong near the dataset they modify.

## 12. Tables and data surfaces

Administration is data-oriented.

Tables should:
- align columns precisely;
- keep readable row rhythm;
- use semantic headers;
- avoid unnecessary decoration;
- keep actions visually secondary;
- remain usable at narrower widths through responsive transformation or controlled overflow.

Never use color-only cells to communicate critical state.

## 13. Cards

Cards are containers, not the default answer to every layout problem.

Use a card when it helps:
- separate a coherent task;
- group related information;
- establish a meaningful surface boundary.

Avoid nested card stacks and cards around every tiny metadata item.

## 14. Status language

Attendance vocabulary:
- Unmarked;
- Present;
- Absent;
- Late;
- Excused.

System vocabulary:
- Loading;
- Saved;
- Unsaved changes;
- Error;
- Retry;
- Protected/Signed where applicable.

Selected state must combine more than color:
- geometry;
- text;
- weight/contrast;
- iconography where useful.

## 15. Focus and interaction

Use a clear :focus-visible treatment.

Current focus token:
#2563eb

Do not remove focus indicators for visual cleanliness.

Do not rely on hover for critical actions.

## 16. Motion

Default authenticated motion is subtle and short.

Good:
- pressed feedback;
- small selection transition;
- save confirmation;
- retry/loading indication.

Avoid:
- long page transitions;
- bouncing attendance states;
- animated dashboards for decoration;
- motion on every table row.

Respect prefers-reduced-motion.

## 17. RTL/LTR

Use logical CSS properties.

Do not hard-code left/right when start/end expresses intent.

Directional controls such as back/forward and previous/next week must communicate correct direction in RTL.

Numbers and codes must remain readable.

## 18. Responsive breakpoints

### Phone (~390px reference)
- mobile-first teacher interaction;
- no routine need for horizontal attendance table;
- compact header;
- horizontal day/period rails where necessary;
- full-width search;
- touch-friendly actions.

### Tablet
- retain the same workflow;
- increase density;
- allow side-by-side controls selectively.

### Desktop (~1440px reference)
- admin sidebar;
- dense tables;
- more simultaneous context;
- eight attendance periods can be visible together where appropriate.

## 19. Shared shell contract

Login and authenticated application must feel related but not identical.

Login:
- focused authentication task;
- stronger brand presentation;
- no admin navigation.

Authenticated pages:
- shared SAMS shell;
- identity;
- user context;
- language control;
- sign-out;
- role-aware navigation.

Never invent a third visual language for a single feature page.

## 20. Design tokens as contract

If a token intentionally changes:
1. update this file;
2. update the implementation token;
3. verify all major surfaces;
4. run visual regression on Login, Admin Dashboard, and representative Teacher screens.

A component must not silently create its own semantic color vocabulary.
