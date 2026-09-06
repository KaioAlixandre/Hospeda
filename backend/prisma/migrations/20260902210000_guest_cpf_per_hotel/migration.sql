-- CPF deve ser único apenas por hotel (Guest_hotelId_cpf_key).
-- Remove índices únicos globais legados, se ainda existirem.

SET @drop_cpf := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `Guest` DROP INDEX `Guest_cpf_key`',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Guest'
    AND INDEX_NAME = 'Guest_cpf_key'
);
PREPARE stmt_cpf FROM @drop_cpf;
EXECUTE stmt_cpf;
DEALLOCATE PREPARE stmt_cpf;

SET @drop_document := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `Guest` DROP INDEX `Guest_document_key`',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Guest'
    AND INDEX_NAME = 'Guest_document_key'
);
PREPARE stmt_document FROM @drop_document;
EXECUTE stmt_document;
DEALLOCATE PREPARE stmt_document;
