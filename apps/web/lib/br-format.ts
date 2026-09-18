export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatCpfOrCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) return formatCpf(digits);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Digitos nacionais (DDD + numero), sem o DDI.
 *
 * Nao completa nem corrige o que foi digitado: o campo e reformatado a cada
 * tecla, entao qualquer digito inventado aqui volta para a tela. Foi isso que
 * quebrou o apagar: ao apagar um digito de um celular completo sobravam 10
 * digitos, a funcao recolocava um "9" e o numero nunca encurtava.
 */
export function normalizeBrazilPhone(value: string) {
  const hasCountryPrefix = value.trim().startsWith("+55");
  let digits = onlyDigits(value).slice(0, 13);

  if (digits.startsWith("55") && (hasCountryPrefix || digits.length > 11)) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 11);
}

export function formatBrazilPhone(value: string) {
  const national = normalizeBrazilPhone(value);
  if (!national) return "";
  if (national.length <= 2) return `+55 (${national}`;
  if (national.length <= 7) return `+55 (${national.slice(0, 2)}) ${national.slice(2)}`;
  return `+55 (${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7, 11)}`;
}

/**
 * Nome e sobrenome. A InfinitePay recusa o link de pagamento inteiro
 * ("Invalid checkout link params") quando o nome do cliente tem uma palavra so,
 * entao o checkout exige pelo menos duas palavras, cada uma com 2+ letras.
 */
export function hasFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter((part) => /\p{L}.*\p{L}/u.test(part));
  return parts.length >= 2;
}
