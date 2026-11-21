# shift

Quero construir um app para gerenciar meus plantões médicos e o quanto vou receber ao fim de cada mês.

Estrutura de telas:
1. Tela de Login:
   - Login com usuário e senha (sem perfil de admin global do serviço).
   - Criar e pré-configurar o primeiro usuário com o login "eduardo" e senha "Ed060795!".

2. Tela Principal em Split View (duas colunas):
   - Lado esquerdo (Calendário & Escala):
     * Seletor de mês para navegar na escala.
     * Calendário visual mostrando os plantões do mês com cores por hospital.
     * Lista dos plantões cadastrados no mês com opções de cadastrar novo, editar e excluir.
     * Cada plantão possui data, hospital, tipo de plantão, valor fixo base e valor variável de produção realizada (sem necessidade de descontos ou emissão de nota fiscal).
     * Função para gerar link privado iCal (.ics / webcal) para sincronizar com Google Agenda e Apple iCloud Calendar.
   - Lado direito (Painel Financeiro):
     * Navegação de mês de recebimento independente.
     * Mostra o total que vai receber naquele mês calculado com base na regra de defasagem de pagamento de cada hospital.
     * Lista discriminando cada plantão correspondente àquele recebimento (data do plantão, hospital, valor fixo e variável).

3. Tela de Configurações:
   - Cadastro de hospitais com nome e cor de identificação.
   - Cadastro dos tipos de plantão e remuneração base.
   - Opção indicando se aquele tipo tem produção variável.
   - Regra de pagamento de cada hospital: dia do pagamento e defasagem (ex.: mesmo mês M+0, mês seguinte M+1, em dois meses M+2).

Estilo visual e UI (replicar o padrão do projeto "cab"):
- Tipografia: Playfair Display para títulos, DM Sans para o corpo e JetBrains Mono para números, horários e valores monetários.
- Paleta de cores: tons de verde esmeralda e sage (--background em tom claro esverdeado 150 20% 96%, primária em esmeralda 156 40% 52%, sidebar escura sofisticada 156 35% 22%).
- Mesmos botões, cards, bordas suaves (radius 0.75rem), inputs e espaçamentos do cab.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://plantaocab.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f318b173-6fa4-4063-ae61-a67e2a8ddd10).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
