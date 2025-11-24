<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\MetricsService;
use Illuminate\Http\Response;

/**
 * Metrics Controller
 *
 * Exposes Prometheus-compatible metrics for monitoring and alerting.
 * This endpoint should be firewalled and only accessible to monitoring systems.
 */
class MetricsController extends Controller
{
    public function __construct(
        private readonly MetricsService $metricsService
    ) {}

    /**
     * Export metrics in Prometheus format
     *
     * @return Response
     */
    public function index(): Response
    {
        $metrics = $this->metricsService->export();

        return response($metrics, 200, [
            'Content-Type' => 'text/plain; version=0.0.4; charset=utf-8',
        ]);
    }
}
