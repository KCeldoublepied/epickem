-- Élimination simple : les formats des quarts, demi-finales et finale deviennent un format par
-- tour, désigné par son nombre de matchs ("4" les quarts, "2" les demies, "1" la finale), pour
-- pouvoir régler aussi les 8es, 16es… (roundBestOf dans stageInputSchema, @epickem/shared).
-- Les anciens réglages ne couvraient que ces trois tours : les autres suivent `bestOf`, comme avant.
UPDATE "stages"
SET "settings" =
  ("settings" - 'quarterFinalBestOf' - 'semiFinalBestOf' - 'finalBestOf')
  || jsonb_build_object(
    'roundBestOf',
    jsonb_strip_nulls(jsonb_build_object(
      '1', "settings" -> 'finalBestOf',
      '2', "settings" -> 'semiFinalBestOf',
      '4', "settings" -> 'quarterFinalBestOf'
    ))
  )
WHERE "format" = 'SINGLE_ELIMINATION';
