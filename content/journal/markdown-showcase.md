---
title: "Markdown Showcases"
date: 2025-12-24T11:02:00.000Z
draft: false
tags: []
slug: markdown-showcases
---

# Heading 1

This post demonstrates common Markdown elements so you can see how they render with the theme. It mixes text styles like **bold**, _italic_, and `inline code`, plus [links](https://example.org) for good measure. You can also combine emphasis like **_bold italic_** and ~~strikethrough~~ to check styles.

> Blockquotes are great for highlighting quotes or callouts.  
> > Nested quotes show depth.

---

## Headings

### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

---

## Lists

- Bullet list item one
- Bullet list item two with a nested list:
  - Nested item A
  - Nested item B
- Bullet list item three

1. Ordered item one
2. Ordered item two
3. Ordered item three

- [x] Completed task
- [ ] Pending task
- [ ] Another task with `inline code`

## Code Blocks

```bash
# Terminal snippet
hugo version
hugo server -D
```

```toml
# Config snippet
[params]
  color = "forest"
```

```js
// JavaScript snippet
const greeting = name => `Hello, ${name}!`;
console.log(greeting("world"));
```

```diff
- console.log("old output");
+ console.log("new output");
```

## Tables

| Feature      | Description                 | Notes          |
| ------------ | --------------------------- | -------------- |
| Typography   | Headings, body text, links  | Check spacing  |
| Lists        | Bulleted, numbered, tasks   | Supports nests |
| Code blocks  | Syntax highlighting styles  | Fenced code    |
| Tables       | Alignment & borders         | Left-aligned   |

## Media

![Sample image](https://images.pexels.com/photos/4614204/pexels-photo-4614204.jpeg "Example.org image")

## Inline Elements

Text with `inline code`, superscript^1^, and a footnote reference.[^footnote] Use <mark>highlight</mark>, <kbd>Ctrl</kbd> + <kbd>C</kbd> for keyboard hints, and emojis like :sparkles:.

Term definitions use definition lists:

Term A
: Definition for term A

Term B
: Definition for term B

---

## Horizontal Rules

Above and below are `---` horizontal rules to check spacing.

---

### Small Print

Use this post to check spacing, margins, line heights, and link colors across all the core Markdown primitives.

[^footnote]: Footnotes render at the bottom of the page.
