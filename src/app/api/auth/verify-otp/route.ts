import { NextRequest } from "next/server";
import { authService } from "@/services/auth.service";
import { verifyOtpSchema } from "@/lib/validations/auth";
import { createSuccessResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/api-error";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = verifyOtpSchema.parse(body);

    const result = await authService.verifyOtp(validatedData);

    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
