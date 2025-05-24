import type { RequestHandler } from '@sveltejs/kit';

// List of allowed origins
const allowedOrigins = [
	'https://bookingruangrapat.vercel.app',
	'http://localhost:5173', // For local development
	'http://localhost:4173' // For local preview
];

// Helper function to check if origin is allowed
function isAllowedOrigin(origin: string | null): boolean {
	if (!origin) return false;
	return allowedOrigins.includes(origin);
}

// CORS headers for preflight requests
export const corsHeaders = {
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Access-Control-Allow-Credentials': 'true'
} as const;

// CORS middleware for SvelteKit endpoints
export function cors(handler: RequestHandler): RequestHandler {
	return async (event) => {
		const origin = event.request.headers.get('origin');

		// Handle preflight requests
		if (event.request.method === 'OPTIONS') {
			if (origin && isAllowedOrigin(origin)) {
				return new Response(null, {
					status: 204,
					headers: {
						...corsHeaders,
						'Access-Control-Allow-Origin': origin
					}
				});
			}
			return new Response(null, { status: 403 });
		}

		// Handle actual request
		const response = await handler(event);

		// Add CORS headers to response if origin is allowed
		if (origin && isAllowedOrigin(origin)) {
			response.headers.set('Access-Control-Allow-Origin', origin);
			Object.entries(corsHeaders).forEach(([key, value]) => {
				response.headers.set(key, value);
			});
		}

		return response;
	};
}
