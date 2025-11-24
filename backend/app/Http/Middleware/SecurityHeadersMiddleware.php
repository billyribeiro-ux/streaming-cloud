<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Security Headers Middleware
 *
 * Adds comprehensive security headers to prevent common web attacks
 *
 * Protection Against:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME-type sniffing
 * - Protocol downgrade attacks
 * - Information leakage
 *
 * Standards Compliance:
 * - OWASP Secure Headers Project
 * - Mozilla Observatory A+ rating
 * - Google Cloud Security Best Practices
 *
 * @package App\Http\Middleware
 */
class SecurityHeadersMiddleware
{
    /**
     * Handle an incoming request
     *
     * @param Request $request
     * @param Closure $next
     * @return Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Apply security headers
        $this->addSecurityHeaders($response);

        return $response;
    }

    /**
     * Add all security headers to response
     *
     * @param Response $response
     * @return void
     */
    protected function addSecurityHeaders(Response $response): void
    {
        // Prevent MIME-type sniffing
        // Protects against: MIME confusion attacks
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Prevent clickjacking
        // Protects against: Clickjacking, UI redress attacks
        $response->headers->set('X-Frame-Options', 'DENY');

        // Enable XSS filter in older browsers
        // Protects against: Reflected XSS attacks
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Content Security Policy
        // Protects against: XSS, data injection, code injection
        $response->headers->set(
            'Content-Security-Policy',
            $this->getContentSecurityPolicy()
        );

        // HTTP Strict Transport Security (HSTS)
        // Protects against: Protocol downgrade, cookie hijacking
        if ($this->shouldEnableHSTS()) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        // Referrer Policy
        // Protects against: Information leakage via Referer header
        $response->headers->set(
            'Referrer-Policy',
            'strict-origin-when-cross-origin'
        );

        // Permissions Policy (formerly Feature-Policy)
        // Protects against: Unauthorized access to browser features
        $response->headers->set(
            'Permissions-Policy',
            $this->getPermissionsPolicy()
        );

        // X-Permitted-Cross-Domain-Policies
        // Protects against: Cross-domain policy attacks
        $response->headers->set(
            'X-Permitted-Cross-Domain-Policies',
            'none'
        );

        // Remove potentially leaky headers
        $this->removeLeakyHeaders($response);
    }

    /**
     * Get Content Security Policy directive
     *
     * @return string
     */
    protected function getContentSecurityPolicy(): string
    {
        $directives = [
            // Default fallback
            "default-src 'self'",

            // Scripts: Allow self + inline for React/Vite
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: Remove unsafe-* in production with nonce

            // Styles: Allow self + inline for Tailwind
            "style-src 'self' 'unsafe-inline'",

            // Images: Allow self + data URIs + external CDNs
            "img-src 'self' data: https:",

            // Fonts: Allow self + data URIs
            "font-src 'self' data:",

            // Connect: API endpoints
            sprintf(
                "connect-src 'self' %s %s %s",
                env('SUPABASE_URL', 'https://*.supabase.co'),
                env('SIGNALING_URL', 'wss://*.tradingroom.io'),
                env('API_URL', 'https://api.tradingroom.io')
            ),

            // Media: Allow self for WebRTC
            "media-src 'self' blob:",

            // WebRTC
            "worker-src 'self' blob:",

            // Forms: Only allow self
            "form-action 'self'",

            // Frames: Disallow all
            "frame-ancestors 'none'",

            // Base URI restriction
            "base-uri 'self'",

            // Upgrade insecure requests
            "upgrade-insecure-requests",
        ];

        return implode('; ', $directives);
    }

    /**
     * Get Permissions Policy directive
     *
     * @return string
     */
    protected function getPermissionsPolicy(): string
    {
        $policies = [
            'camera=(self)',          // Allow camera for WebRTC
            'microphone=(self)',      // Allow microphone for WebRTC
            'geolocation=()',         // Block geolocation
            'payment=()',             // Block payment (use Stripe iframe)
            'usb=()',                 // Block USB
            'magnetometer=()',        // Block sensors
            'gyroscope=()',
            'accelerometer=()',
            'ambient-light-sensor=()',
            'autoplay=(self)',        // Allow autoplay for video
            'fullscreen=(self)',      // Allow fullscreen for rooms
            'picture-in-picture=()',  // Block PiP
        ];

        return implode(', ', $policies);
    }

    /**
     * Check if HSTS should be enabled
     *
     * @return bool
     */
    protected function shouldEnableHSTS(): bool
    {
        // Only enable HSTS in production with HTTPS
        return config('app.env') === 'production'
            && request()->secure();
    }

    /**
     * Remove headers that leak information
     *
     * @param Response $response
     * @return void
     */
    protected function removeLeakyHeaders(Response $response): void
    {
        // Remove server version info
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        // Remove framework version info
        $response->headers->remove('X-Laravel-Version');
    }
}
