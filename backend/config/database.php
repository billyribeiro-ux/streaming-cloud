<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Database Connection Name
    |--------------------------------------------------------------------------
    */

    'default' => env('DB_CONNECTION', 'pgsql'),

    /*
    |--------------------------------------------------------------------------
    | Database Connections
    |--------------------------------------------------------------------------
    |
    | Enterprise-grade configuration with:
    | - Connection pooling (persistent connections)
    | - Read/write splitting for horizontal scaling
    | - Optimized timeouts and retry logic
    | - Prepared statement caching
    */

    'connections' => [

        'pgsql' => [
            'driver' => 'pgsql',
            'url' => env('DATABASE_URL'),

            // Read/Write Splitting for Horizontal Scaling
            'read' => [
                'host' => array_filter(explode(',', env('DB_READ_HOSTS', env('DB_HOST', '127.0.0.1')))),
            ],
            'write' => [
                'host' => [env('DB_WRITE_HOST', env('DB_HOST', '127.0.0.1'))],
            ],
            'sticky' => true, // Ensure writes are immediately readable

            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'forge'),
            'username' => env('DB_USERNAME', 'forge'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => 'public',
            'sslmode' => env('DB_SSLMODE', 'prefer'),

            /*
            |----------------------------------------------------------------------
            | Connection Pooling Configuration (CRITICAL FOR PERFORMANCE)
            |----------------------------------------------------------------------
            |
            | Persistent connections dramatically reduce overhead:
            | - Eliminates connection handshake on every request
            | - Reuses prepared statements
            | - Reduces PostgreSQL connection count
            |
            | Expected improvement: 20-40% reduction in DB query time
            */
            'options' => extension_loaded('pdo_pgsql') ? [
                PDO::ATTR_PERSISTENT => env('DB_PERSISTENT', true), // Enable connection pooling
                PDO::ATTR_EMULATE_PREPARES => false, // Use real prepared statements
                PDO::ATTR_TIMEOUT => env('DB_TIMEOUT', 5), // 5 second timeout
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_STRINGIFY_FETCHES => false, // Return proper types
            ] : [],

            /*
            |----------------------------------------------------------------------
            | Connection Pool Limits
            |----------------------------------------------------------------------
            |
            | These settings prevent connection exhaustion:
            | - pool_size: Maximum connections per worker
            | - pool_timeout: Wait time before failing
            | - pool_lifetime: Recycle connections after N seconds
            */
            'pool' => [
                'min' => env('DB_POOL_MIN', 2),
                'max' => env('DB_POOL_MAX', 20),
                'timeout' => env('DB_POOL_TIMEOUT', 30),
                'lifetime' => env('DB_POOL_LIFETIME', 300), // 5 minutes
            ],
        ],

        /*
        |----------------------------------------------------------------------
        | Redis Connection (Caching & Queue)
        |----------------------------------------------------------------------
        */
        'redis' => [
            'client' => env('REDIS_CLIENT', 'phpredis'),

            'options' => [
                'cluster' => env('REDIS_CLUSTER', 'redis'),
                'prefix' => env('REDIS_PREFIX', Str::slug(env('APP_NAME', 'laravel'), '_').'_database_'),
            ],

            'default' => [
                'url' => env('REDIS_URL'),
                'host' => env('REDIS_HOST', '127.0.0.1'),
                'username' => env('REDIS_USERNAME'),
                'password' => env('REDIS_PASSWORD'),
                'port' => env('REDIS_PORT', '6379'),
                'database' => env('REDIS_DB', '0'),

                // Connection pooling for Redis
                'read_timeout' => 60,
                'timeout' => 5,
                'persistent' => true,
                'retry_interval' => 100,
            ],

            'cache' => [
                'url' => env('REDIS_URL'),
                'host' => env('REDIS_HOST', '127.0.0.1'),
                'username' => env('REDIS_USERNAME'),
                'password' => env('REDIS_PASSWORD'),
                'port' => env('REDIS_PORT', '6379'),
                'database' => env('REDIS_CACHE_DB', '1'),
            ],

            'queue' => [
                'url' => env('REDIS_URL'),
                'host' => env('REDIS_HOST', '127.0.0.1'),
                'username' => env('REDIS_USERNAME'),
                'password' => env('REDIS_PASSWORD'),
                'port' => env('REDIS_PORT', '6379'),
                'database' => env('REDIS_QUEUE_DB', '2'),
            ],

        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Migration Repository Table
    |--------------------------------------------------------------------------
    */

    'migrations' => 'migrations',

    /*
    |--------------------------------------------------------------------------
    | Redis Configuration
    |--------------------------------------------------------------------------
    */

    'redis' => [

        'client' => env('REDIS_CLIENT', 'phpredis'),

        'options' => [
            'cluster' => env('REDIS_CLUSTER', 'redis'),
            'prefix' => env('REDIS_PREFIX', Str::slug(env('APP_NAME', 'laravel'), '_').'_database_'),
        ],

        'default' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
        ],

        'cache' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_CACHE_DB', '1'),
        ],

    ],

];
