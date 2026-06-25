/**
 * Async Handler Wrapper
 *
 * Wraps an async Express route handler so that any rejected promise
 * is automatically forwarded to Express's error middleware via next(error).
 *
 * Without asyncHandler — repetitive try/catch in every controller:
 *   const getJobs = async (req, res, next) => {
 *     try {
 *       const jobs = await jobService.getAll();
 *       res.json(new ApiResponse(200, jobs, 'Jobs fetched'));
 *     } catch (error) {
 *       next(error);
 *     }
 *   };
 *
 * With asyncHandler — clean and DRY:
 *   const getJobs = asyncHandler(async (req, res) => {
 *     const jobs = await jobService.getAll();
 *     res.json(new ApiResponse(200, jobs, 'Jobs fetched'));
 *   });
 *
 * @param {Function} fn - Async Express route handler (req, res, next) => Promise
 * @returns {Function} Express middleware that catches promise rejections
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
