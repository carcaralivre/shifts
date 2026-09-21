# Cadastro de plantões em várias datas

## Objetivo
Permitir cadastrar o mesmo plantão em várias datas de uma só vez, mantendo o fluxo atual simples para quem informa apenas uma data.

## Alterações
- Manter a primeira data como hoje e adicionar um botão “+” ao lado dela.
- Cada clique no “+” adiciona outro campo de data; datas extras podem ser removidas antes de salvar.
- Hospital, tipo, valores e observações serão compartilhados por todas as datas.
- Ao salvar um novo plantão, criar um registro para cada data informada e atualizar agenda e recebimentos uma única vez.
- Na edição de um plantão existente, manter apenas uma data para evitar alterações acidentais em outros registros.
- Bloquear datas repetidas e mostrar uma mensagem clara se alguma data estiver vazia ou duplicada.
- Exibir estado de salvamento e impedir envios repetidos.

## Validação
- Conferir cadastro com uma e várias datas.
- Conferir remoção de uma data extra, prevenção de duplicidade e edição individual.
- Validar a apresentação em computador e celular e confirmar ausência de erros.
