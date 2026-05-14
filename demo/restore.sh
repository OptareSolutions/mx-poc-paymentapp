#!/usr/bin/env bash
# Restaura los tres archivos tocados por BREAK 1 y BREAK 2 (respecto al último commit).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "Restaurando archivos con git checkout -- ..."
git checkout -- \
  microservice-b/src/main/java/com/att/paymentbox/customerprofile/dto/CustomerProfileDto.java \
  microservice-b/src/test/java/com/att/paymentbox/customerprofile/controller/CustomerControllerTest.java \
  microservice-a/src/main/java/com/att/paymentbox/service/RecargaService.java

echo "OK Archivos restaurados al HEAD actual."
cat <<'EOS'

Siguiente:
  git status
  git commit -am "demo: restaurar estado verde"   # o git add + commit
  git push

Si ya fusionaste un BREAK en E, puede hacer falta git revert del merge.

EOS
