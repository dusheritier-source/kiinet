import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // Additional middleware logic if needed
    return;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/feed/:path*",
    "/messages/:path*",
    "/settings/:path*",
    "/upload/:path*",
    "/notifications/:path*",
    "/bookmarks/:path*",
  ],
};