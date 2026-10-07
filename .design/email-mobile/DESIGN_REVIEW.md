# Revisão do e-mail de ingresso no celular

Direção: preservar a composição horizontal do ingresso, reduzir a altura total, manter ícones separados do texto e proteger títulos claros sobre fundos escuros. Referência: prints de Gmail iOS enviados pelo usuário em 07/10/2026.

Correções aplicadas:
- Grade de informações em duas colunas, com largura reservada para cada ícone e espaçamento explícito.
- Dados do ingresso e QR lado a lado no celular; data/hora na mesma linha e setor em uma faixa com espaço para o nome completo.
- Cabeçalho, margens e botões compactos. Os três botões permanecem na mesma linha.
- Títulos, nome do participante, valores e legenda do QR usam camadas de mesclagem restritas ao Gmail para resistir à inversão de texto sobre imagens. Referência técnica: https://www.hteumeuleu.com/2021/fixing-gmail-dark-mode-css-blend-modes/
- Logotipo do rodapé usa texto branco sobre uma superfície escura preservada.

## Verificação

Capturas locais do HTML efetivamente gerado, nos dois temas e nas larguras 320, 375, 390, 768 e 1280. No celular de 375 px, o modelo fica perto de 1.130 px de altura, sem rolagem horizontal. O QR tem aproximadamente 123 px de largura. Testes Playwright verificam alinhamento das colunas, data/hora, botões, espaço dos ícones, largura do QR e altura máxima.

Capturas em `screenshots/{standard,vip}-{320,375,390,768,1280}-{light,dark}.png`.

As capturas de navegador cobrem media queries e geometria. Não equivalem a uma entrega real no aplicativo Gmail iOS; a proteção de inversão segue a técnica específica desse cliente. Não foi enviado e-mail a destinatários reais nesta verificação.
