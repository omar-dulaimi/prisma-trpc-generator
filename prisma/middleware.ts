export default async ({ ctx, next }) => {
  console.log("Hello from the imported Middleware");
  return next({ ctx });
}
