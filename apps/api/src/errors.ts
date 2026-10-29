export class ApiDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = statusForCode(code),
  ) {
    super(message);
    this.name = "ApiDomainError";
  }
}

function statusForCode(code: string): number {
  if (code === "FORBIDDEN") return 403;
  if (["NOT_FOUND", "GROUP_NOT_FOUND", "NO_GROUP", "MEMBER_NOT_FOUND"].includes(code)) return 404;
  if (["LOCKED", "INVALID_STATE", "TOPIC2_LOCKED"].includes(code)) return 409;
  return 400;
}
