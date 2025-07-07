# Frequently Asked Questions

## General

### What is this system for?

This is a production management system for televised church services. It handles programme planning, recording schedules, contributor management and integration with broadcast equipment.

### Who is this designed for?

Production coordinators, directors and technical staff working on multi-day church service recordings for television broadcast.

### What makes this different from a spreadsheet?

Whilst it runs inside Google Sheets, the underlying architecture is database-driven. Data is stored once in normalised tables; views are generated dynamically. This prevents duplication errors and enables API integration.

---

## Technical

### Why Google Sheets and not a proper database?

Pragmatic choice. Google Sheets provides:
- Zero infrastructure cost
- Familiar interface for non-technical users
- Built-in collaboration and sharing
- Mobile access without app development
- Automatic versioning

The trade-off is performance at scale, which is acceptable for productions with <500 posts.

### Can this handle multiple simultaneous users?

Yes. Google Sheets handles concurrent editing. The database layer uses row-level operations to minimise conflicts. For high-concurrency scenarios, the Supabase backend (2026 architecture) provides proper locking.

### What happens if I edit the database sheets directly?

The system will continue to function, but you bypass validation logic. Use the provided menus and dialogues for normal operations. Direct database access is intended for debugging only.

### How do I back up my data?

Three options:
1. **Manual:** System > Backup to JSON
2. **Automatic:** Enable scheduled backups via System > Backup & Restore > Enable Automatic Backup
3. **Google native:** File > Version history (built into Sheets)

### Can I use this offline?

Google Sheets has limited offline support. For true offline operation, the iPad Studio PWA (2026 architecture) uses a service worker for caching.

---

## Integration

### How do I connect Bitfocus Companion?

1. Deploy the Apps Script as a Web App
2. Note the deployment URL
3. Generate an API key via Integration > API Keys
4. Configure Companion's HTTP module with the URL and key

See [API.md](API.md) for endpoint documentation.

### Does this work with vMix?

Yes. Use vMix's scripting capabilities to call the HTTP API. The system can receive timecode data and update post status automatically.

### Can I integrate with other systems?

Any system that can make HTTP requests can integrate via the REST API. Common integrations include:
- Deck control (HyperDeck, Ki Pro)
- Video mixers (ATEM, Tricaster)
- Graphics systems (CasparCG, Viz)
- Prompters

---

## Data

### What is a "post"?

A post is a single segment within a programme. Examples: a sermon, a hymn, a scripture reading, an interview segment. Each post has a type, duration, contributors and recording status.

### What is the difference between Programme and Post?

A **Programme** is a complete broadcast episode (typically 43:30 duration). Each programme contains multiple **Posts** (typically 15–30 segments).

### How are contributors managed?

Contributors (people who appear on camera) are stored in a central registry. When you add a contributor to a post, you reference them by name. New names are automatically added to the registry.

### Can I import data from Excel?

Not directly. However, you can:
1. Export your Excel data to CSV
2. Use Posts > Import (CSV/TSV) to bring it in
3. Manually copy-paste into the database sheets (advanced)

---

## Troubleshooting

### The menus are not appearing

Reload the page. If still missing, open the Script Editor and run the `onOpen()` function manually.

### Changes in views are not saving

Check that edit triggers are installed. Open Script Editor > Triggers and verify that `onEdit` triggers exist for the project.

### The schedule view is empty

Run System > Generate All Views. If still empty, check that your posts have recording day assignments.

### Performance is slow

- Reduce the number of rows displayed (add LIMIT to QUERY)
- Hide unused programme sheets
- Clear conditional formatting rules you don't need
- Use the caching layer (enabled by default in 2026 architecture)

### I deleted something by mistake

Check the Recycle Bin: Posts > Recycle Bin > View Deleted Posts. Soft-deleted items can be restored within 30 days.

---

## Best Practices

### How should I structure recording days?

A typical three-day structure:
- **Day 1:** Static elements (sermons, readings, interviews)
- **Day 2:** Music elements (choir, solos, organ)
- **Day 3:** Congregation elements (full run-through with audience)

### What is the recommended workflow?

1. Create programme metadata first
2. Add contributors
3. Build posts in rough order
4. Assign recording days
5. Generate schedule view
6. Use schedule during recording
7. Update status as you record
8. Archive when complete

### How do I handle changes during recording?

Edit directly in the Programme view. Changes propagate immediately to the database. For major restructuring, use the Posts menu functions.

---

## Architecture

### What is the 2026 architecture?

An optional hybrid setup that adds:
- **Supabase:** PostgreSQL database with ACID guarantees
- **Cloudflare Worker:** Synchronisation and conflict resolution
- **iPad PWA:** Touch-optimised studio view

This provides better performance, offline support and real-time collaboration whilst keeping Google Sheets as the primary interface.

### Do I need the 2026 architecture?

No. The base system (Sheets-only) is fully functional. The 2026 architecture is for teams that need:
- Real-time multi-device updates
- Offline iPad operation
- Audit logging with database guarantees
- Higher performance at scale

### What does it cost?

The base system: free (Google Sheets).
The 2026 architecture: free (Supabase free tier, Cloudflare free tier, Vercel free tier).

---

## Support

### Where do I report bugs?

GitHub Issues: https://github.com/FiLORUX/the-public-service/issues

### How do I request features?

Open a GitHub Issue with the "enhancement" label, or submit a pull request.

### Is commercial support available?

Contact david@thast.se for consultancy enquiries.
