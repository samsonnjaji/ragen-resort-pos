export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) {
    if (error.message.includes("Unique constraint") && error.message.includes("sku")) {
      return "This SKU is already in use. Choose a unique SKU or restore the archived product from Archive.";
    }
    if (error.message.includes("Unique constraint") && error.message.includes("name")) {
      return "This name already exists. Please use a different name.";
    }
    if (error.message.includes("Foreign key constraint") || error.message.includes("categoryId")) {
      return "Invalid category. Please select a category from the list.";
    }
    return error.message;
  }
  return fallback;
}

/** Map Prisma errors to user-friendly AppError messages. */
export function rethrowPrisma(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; meta?: { target?: string[] | string } };
    if (prismaError.code === "P2002") {
      const target = prismaError.meta?.target;
      const fields = Array.isArray(target) ? target.join(", ") : String(target ?? "field");
      if (fields.includes("sku")) {
        throw new AppError(
          "This SKU is already in use. Choose a unique SKU or restore the archived product from Archive."
        );
      }
      if (fields.includes("name")) {
        throw new AppError("This name already exists. Please use a different name.");
      }
      throw new AppError("A record with this value already exists.");
    }
    if (prismaError.code === "P2003") {
      throw new AppError("Invalid category. Please select a category from the list.");
    }
  }
  throw error;
}
