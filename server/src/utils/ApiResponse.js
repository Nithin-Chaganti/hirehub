/**
 * Standardized API Response Class
 *
 * Ensures every successful response follows the same shape:
 * {
 *   success: true,
 *   message: "Descriptive success message",
 *   data: { ... },
 *   pagination: { page, limit, total, pages }  // only for list endpoints
 * }
 *
 * Usage in controllers:
 *   res.status(200).json(new ApiResponse(200, jobs, 'Jobs fetched successfully', pagination));
 *   res.status(201).json(new ApiResponse(201, user, 'Registration successful'));
 */
class ApiResponse {
  constructor(statusCode, data, message = 'Success', pagination = null) {
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;

    if (pagination) {
      this.pagination = pagination;
    }
  }
}

export default ApiResponse;
