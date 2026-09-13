# Character asset provenance

Created with the built-in `image_gen.imagegen` tool from user-supplied reference photos. No external character images were used. All final game assets live in `public/assets/`.

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

## T-Shirt Owen — `public/assets/tshirt-owen-key.png`

Created with the built-in image-generation tool from the user's reference named **T-Shirt Owen**. Final source dimensions: 1024×1536. The character remains a cosmetic sprite with the original hero's gameplay scale and collision size.

Initial prompt:

> Use case: identity-preserve. Asset type: full-body photographic player sprite for Pat's Bar. Input image 1 is the user's reference for T-Shirt Owen. Make a single clean full-body cutout of this same adult man, preserving his recognizable face, short dark hair, black oversized graphic T-shirt, forearm tattoos, black loose trousers and black/white shoes. Remove phone, drink cup, mirror, furniture and room. Both empty hands relaxed at sides, standing front-facing in a neutral pose. Entire head and both shoes visible, centered, portrait 2:3 composition with small even margin; feet near the bottom. Real photographic detail matching a photo-cutout video game character. Keep the shirt's existing monochrome graphic styling; no extra text or labels, no watermark. Genuinely transparent alpha background, no checkerboard baked into pixels, no ground shadow. The sprite must have a clean transparent silhouette ready to place on a Three.js countertop.

The initial output was RGB with a baked-in checkerboard, so it was refined with:

> Use case: background-extraction. Edit this exact T-Shirt Owen sprite. Replace all checkerboard background pixels with perfectly uniform pure chroma green #00FF00. Keep the man unchanged: same face, hair, shirt graphic, tattoos, hands, black trousers and shoes. Full body stays in exactly the same framing and pose. No shadows, gradient, texture or checkerboard in background. This flat green background will be removed by the existing game's shader. Do not change the subject.

The final RGB file uses the same runtime chroma key as the original hero and boss. Facial detail and shirt artwork are generated approximations of the supplied photo. The final asset is copied into the project; the app does not depend on the generation tool's output directory.

## Hoodie colors

Blue, purple, black, and gold use `hero-key.png` with a bounded fabric-color shader; no new photographic assets were generated for those variants. The original face, trousers, shoes, pose, and body shape are retained. Transparent shop thumbnails are rendered once from the same Three.js materials as gameplay and cached for the page session.
