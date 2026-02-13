<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as the signaling server, Stripe, and Cloudflare R2 object storage.
    |
    */

    'signaling' => [
        'url' => env('SIGNALING_SERVER_URL', 'http://localhost:4000'),
        'secret' => env('SIGNALING_SERVER_SECRET', ''),
    ],

    'stripe' => [
        'key' => env('STRIPE_KEY', ''),
        'secret' => env('STRIPE_SECRET', ''),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET', ''),
    ],

    'r2' => [
        'access_key_id' => env('R2_ACCESS_KEY_ID', ''),
        'secret_access_key' => env('R2_SECRET_ACCESS_KEY', ''),
        'bucket' => env('R2_BUCKET', 'tradingroom-files'),
        'endpoint' => env('R2_ENDPOINT', ''),
        'public_url' => env('R2_PUBLIC_URL', ''),
        'region' => env('R2_REGION', 'auto'),
    ],

];
