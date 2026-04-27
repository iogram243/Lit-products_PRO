# Digital Shelf: Site Context

Digital Shelf is a showcase catalog for downloadable tools, browser extensions, ZIP packages, and EXE utilities aimed at writers and authors who work on book platforms.

## Main roles

- Guest: can browse the catalog and open product cards, but must sign in to download files.
- User: can sign in, download products, receive notifications, leave wishes for new tools, and report bugs.
- Admin: can create and edit products, upload archives and images, publish updates, control whether an update should show a red notice, review wishes and bug reports, and view analytics.

## Main user-facing functions

- Catalog of products filtered by service and sorted by date.
- Product card with service badge, product type, screenshots, description, download button, and pending update banner.
- Product modal with screenshot gallery, larger description, download button, and update information.
- Account page with notifications and request history.
- Wish modal where a signed-in user chooses a service and describes what program or feature they want.
- Bug-report modal where a signed-in user chooses an existing product and describes a problem.

## Product and admin functions

- Products belong to a service such as Litnet, Litmarket, Litgorod, or Author Today.
- A product can have a logo, gallery images, ZIP/EXE archive, type, description, and optional red "new" badge.
- Admin can publish product updates. Updates may either:
  - notify users and show a red "new update" block, or
  - quietly replace files without showing a red update block.
- Users who download a marked update stop seeing that update notice for that product.

## AI task on this site

When a user opens the wish modal, the AI must help rewrite the user's idea into a clearer request or technical brief for the admin/developer.

The AI should assume:

- the user is describing a desired tool, extension, automation, helper, parser, uploader, dashboard improvement, or workflow acceleration feature;
- the request should stay tied to the selected service;
- the output should be practical and implementation-oriented;
- the AI must not invent platform features unless they are plausible and clearly framed as a proposal;
- the AI should preserve the user's goal and avoid adding unrelated scope.

## Writing rules for the AI

- Keep the original intent.
- Rewrite vague requests into concrete developer language.
- Prefer action-oriented wording: what the tool should do, where it should work, what result the user expects.
- If the request already looks clear, improve structure rather than changing meaning.
- If generating a technical brief, structure it with short sections such as:
  - Goal
  - Where it works
  - Required actions
  - Expected result
  - Optional extras
