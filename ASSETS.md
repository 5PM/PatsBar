# Character asset provenance

Created with the built-in `image_gen.imagegen` tool from the two user-supplied reference photos. No external character images were used. All final game assets live in `public/assets/`.

## Hero — `public/assets/hero-key.png`

Initial prompt:

> Use case: identity-preserve. Create a transparent PNG full-body photographic game sprite of the man in this reference. Preserve his face, short dark hair and red hoodie closely. Remove phone and background. Both hands relaxed at sides. Extend body with dark jeans and sneakers. Front facing standing pose, entire body and shoes visible, centered tightly in portrait canvas with small margin. Real photographic cutout, no ground shadow, no text added, genuinely transparent alpha background. This is the hero sprite for a playful miniature bar countertop game.

Final refinement prompt:

> Extract this exact man as a clean full body cutout. Replace all checkerboard with a perfectly uniform solid chroma green #00FF00 background, absolutely flat with no texture, no shading or shadow, no checkerboard. Keep man unchanged. Full body shoes visible. Output portrait image. Background must be pure green for game shader chroma key.

## Boss — `public/assets/boss-key.png`

Initial prompt:

> Use case: identity-preserve. Create a transparent PNG full-body photographic game sprite of the man in this reference. Preserve his face, shaggy dark hair, round glasses, olive jacket, striped cream sweater, beige trousers closely. Remove background and any handheld object. Extend missing lower legs with beige trousers and brown casual shoes. Front facing standing pose with hands at sides, entire body and shoes visible, centered tightly in portrait canvas with small margin. Real photographic cutout, no ground shadow, no text, genuinely transparent alpha background. This is a giant boss sprite for a playful miniature bar countertop game.

Final refinement prompt:

> Extract this exact man as a clean full body cutout. Replace all checkerboard with a perfectly uniform solid chroma green #00FF00 background, absolutely flat with no texture, no shading or shadow, no checkerboard. Keep man unchanged including olive jacket, glasses, sweater, trousers and shoes. Full body shoes visible. Output portrait image. Background must be pure vivid green for game shader chroma key.

The initial outputs contained baked-in checkerboards. The final files are RGB green-screen sprites; runtime shader chroma key removes the background, softens the silhouette, and suppresses green spill. This preserves the generated photographic clothing and face without a rectangular background in the game.
