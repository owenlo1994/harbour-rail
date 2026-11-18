# Real PBF fixture provenance

`pbf-junctions.json` is a local subset derived from Geofabrik `hong-kong-261114.osm.pbf`, SHA-256 `adb3fab0be54bf52155ff98fc1d1f09195f634889c7da397ede3893ec851f9ad`; header replication timestamp `2026-11-14T21:20:41Z`.

© OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright . Original node/way/relation IDs, coordinates and tags are preserved. There are no hand-drawn or estimated coordinates.

Scope: four explicit geographic junction windows recorded in fixture metadata. Entire intersecting ways plus their nodes are retained; relation member lists are restricted to the subset. Two original SWT stop nodes are also retained for the official CSV SUW mismatch regression. This is not a complete regional PBF: cropping can itself split routes. Tests distinguish the known real source-order gap from any fixture-boundary splits.

Source PBF MD5: `a585484ef8ac2181d6dcce07f0e7bdba`, verified against the downloaded Geofabrik sidecar. No test downloads data.

`tcl-approved-order.json` is a second real subset from the same verified PBF: the complete original relation 5317704 member list, all 54 track ways with all their source nodes, plus construction-station nodes 11039819033/11039819034. It tests only the explicit user-confirmed order exception and unopened station coordinates. The source order is preserved in the fixture; the test also verifies that every edge in the reordered animation path exists in an original way. © OpenStreetMap contributors, ODbL 1.0.
