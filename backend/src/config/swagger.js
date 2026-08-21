const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUiDist = require('swagger-ui-dist');

const serverUrl = process.env.SWAGGER_SERVER_URL
    || process.env.PUBLIC_BASE_URL
    || `http://localhost:${process.env.PORT || 5000}`;

const protectedOperation = (operation) => ({
    ...operation,
    security: [{ bearerAuth: [] }]
});

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Smart Gym Using AI Agent API',
            version: '1.0.0',
            description: 'REST API for Smart Gym mobile app, web app, and AI services.'
        },
        servers: [{ url: serverUrl }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'success' },
                        data: { type: 'object' }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'error' },
                        message: { type: 'string' }
                    }
                },
                RegisterRequest: {
                    type: 'object',
                    required: ['username', 'email', 'password'],
                    properties: {
                        username: { type: 'string', example: 'Mostafa' },
                        email: { type: 'string', example: 'mostafa@example.com' },
                        password: { type: 'string', example: 'Pass123!' },
                        phone: { type: 'string', example: '01000000000' }
                    }
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', example: 'mostafa@example.com' },
                        password: { type: 'string', example: 'Pass123!' },
                        role: { type: 'string', example: 'user' }
                    }
                },
                BodyDataRequest: {
                    type: 'object',
                    required: ['weight', 'height'],
                    properties: {
                        weight: { type: 'number', example: 85 },
                        height: { type: 'number', example: 175 },
                        bodyFat: { type: 'number', example: 22 },
                        age: { type: 'number', example: 23 },
                        gender: { type: 'string', example: 'male' },
                        activityLevel: { type: 'string', example: 'moderate' },
                        fitnessGoal: { type: 'string', example: 'fat loss' }
                    }
                },
                MachineBookingRequest: {
                    type: 'object',
                    required: ['machineId', 'bookingDate', 'startTime'],
                    properties: {
                        machineId: { type: 'number', example: 1 },
                        bookingDate: { type: 'string', example: '2026-05-09' },
                        startTime: { type: 'string', example: '22:00' },
                        endTime: { type: 'string', example: '22:05' },
                        durationMinutes: { type: 'number', example: 5, description: 'Allowed range: 5 to 120 minutes. Use this instead of endTime if preferred.' }
                    }
                },
                TokenBuyRequest: {
                    type: 'object',
                    required: ['amount'],
                    properties: {
                        amount: { type: 'number', example: 50 },
                        method: { type: 'string', example: 'card' }
                    }
                },
                ChatRequest: {
                    type: 'object',
                    required: ['toUserId', 'content'],
                    properties: {
                        toUserId: { type: 'number', example: 2 },
                        content: { type: 'string', example: 'Can we schedule my next session?' }
                    }
                },
                AiChatRequest: {
                    type: 'object',
                    required: ['message'],
                    properties: {
                        message: { type: 'string', example: 'Give me a quick recovery tip.' }
                    }
                },
                AddToCartRequest: {
                    type: 'object',
                    required: ['productId'],
                    properties: {
                        productId: { type: 'integer', example: 1 },
                        quantity: { type: 'integer', example: 1, description: 'Default is 1 if not provided' }
                    }
                },
                UpdateCartRequest: {
                    type: 'object',
                    required: ['quantity'],
                    properties: {
                        quantity: { type: 'integer', example: 3, description: 'Set to 0 to remove item' }
                    }
                },
                CheckoutRequest: {
                    type: 'object',
                    properties: {
                        paymentMethod: { type: 'string', example: 'card', description: 'Any label e.g. card, cash, wallet. Default: card' }
                    }
                },
                AddPaymentMethodRequest: {
                    type: 'object',
                    required: ['cardLast4', 'cardHolder'],
                    properties: {
                        cardType: { type: 'string', example: 'Visa', description: 'Card brand e.g. Visa, MasterCard' },
                        cardLast4: { type: 'string', example: '4242', description: 'Last 4 digits of card' },
                        cardHolder: { type: 'string', example: 'Mostafa Ahmed' }
                    }
                }
            }
        }
    },
    apis: []
};

const spec = swaggerJsdoc(options);
const swaggerAssetPath = swaggerUiDist.getAbsoluteFSPath();

spec.paths = {
    '/api/auth/register': {
        post: {
            tags: ['Auth'],
            summary: 'Register a member',
            requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
            responses: { 201: { description: 'Created' } }
        }
    },
    '/api/auth/login': {
        post: {
            tags: ['Auth'],
            summary: 'Login user, coach, or admin',
            requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
            responses: { 200: { description: 'Success' } }
        }
    },
    '/api/auth/profile': { get: protectedOperation({ tags: ['Auth'], summary: 'Get authenticated profile', responses: { 200: { description: 'Success' } } }) },
    '/api/user/profile': { get: protectedOperation({ tags: ['User'], summary: 'Get current user profile', responses: { 200: { description: 'Success' } } }) },
    '/api/user/update-profile': { put: protectedOperation({ tags: ['User'], summary: 'Update username and phone', responses: { 200: { description: 'Success' } } }) },
    '/api/user/body-data': { put: protectedOperation({ tags: ['User'], summary: 'Save body metrics and AI body context', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BodyDataRequest' } } } }, responses: { 200: { description: 'Success' } } }) },
    '/api/user/progress': { get: protectedOperation({ tags: ['User'], summary: 'Get body progress history', responses: { 200: { description: 'Success' } } }) },
    '/api/workout/generate': { post: protectedOperation({ tags: ['Workout'], summary: 'Generate AI workout plan', requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/BodyDataRequest' } } } }, responses: { 201: { description: 'Created' } } }) },
    '/api/workout/current': { get: protectedOperation({ tags: ['Workout'], summary: 'Get current workout plan', responses: { 200: { description: 'Success' } } }) },
    '/api/workout/history': { get: protectedOperation({ tags: ['Workout'], summary: 'Get workout history', responses: { 200: { description: 'Success' } } }) },
    '/api/workout/progress': { put: protectedOperation({ tags: ['Workout'], summary: 'Save workout progress payload', responses: { 200: { description: 'Success' } } }) },
    '/api/meal/generate': { post: protectedOperation({ tags: ['Meal'], summary: 'Generate AI meal plan', requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/BodyDataRequest' } } } }, responses: { 201: { description: 'Created' } } }) },
    '/api/meal/current': { get: protectedOperation({ tags: ['Meal'], summary: 'Get current meal plan', responses: { 200: { description: 'Success' } } }) },
    '/api/meal/history': { get: protectedOperation({ tags: ['Meal'], summary: 'Get meal plan history', responses: { 200: { description: 'Success' } } }) },
    '/api/machines': { get: protectedOperation({ tags: ['Machines'], summary: 'List all machines', responses: { 200: { description: 'Success' } } }) },
    '/api/machines/available': { get: protectedOperation({ tags: ['Machines'], summary: 'List available machines', responses: { 200: { description: 'Success' } } }) },
    '/api/machines/{id}/booked-times': { get: protectedOperation({ tags: ['Machines'], summary: 'Get booked time ranges for selected machine and day', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'number' } }, { name: 'date', in: 'query', required: true, schema: { type: 'string', example: '2026-05-09' } }], responses: { 200: { description: 'Success' } } }) },
    '/api/machines/book': { post: protectedOperation({ tags: ['Machines'], summary: 'Book machine with tokens', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MachineBookingRequest' } } } }, responses: { 201: { description: 'Created' } } }) },
    '/api/machines/cancel': { delete: protectedOperation({ tags: ['Machines'], summary: 'Cancel machine booking', responses: { 200: { description: 'Success' } } }) },
    '/api/machines/bookings': { get: protectedOperation({ tags: ['Machines'], summary: 'Get user machine booking history', responses: { 200: { description: 'Success' } } }) },
    '/api/tokens/balance': { get: protectedOperation({ tags: ['Tokens'], summary: 'Get token balance', responses: { 200: { description: 'Success' } } }) },
    '/api/tokens/buy': { post: protectedOperation({ tags: ['Tokens'], summary: 'Buy tokens', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenBuyRequest' } } } }, responses: { 201: { description: 'Created' } } }) },
    '/api/tokens/history': { get: protectedOperation({ tags: ['Tokens'], summary: 'Get token history', responses: { 200: { description: 'Success' } } }) },
    '/api/qr/checkin': { post: protectedOperation({ tags: ['QR'], summary: 'Check in member', responses: { 201: { description: 'Created' } } }) },
    '/api/qr/checkout': { post: protectedOperation({ tags: ['QR'], summary: 'Check out member', responses: { 200: { description: 'Success' } } }) },
    '/api/attendance/history': { get: protectedOperation({ tags: ['QR'], summary: 'Get attendance history', responses: { 200: { description: 'Success' } } }) },
    '/api/chat/send': { post: protectedOperation({ tags: ['Chat'], summary: 'Send chat message', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } } }, responses: { 201: { description: 'Created' } } }) },
    '/api/chat/history': { get: protectedOperation({ tags: ['Chat'], summary: 'Get chat history with a user', responses: { 200: { description: 'Success' } } }) },
    '/api/chat/conversations': { get: protectedOperation({ tags: ['Chat'], summary: 'Get conversation list', responses: { 200: { description: 'Success' } } }) },
    '/api/chat/ai': { post: protectedOperation({ tags: ['Chat'], summary: 'Get AI chat reply', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AiChatRequest' } } } }, responses: { 200: { description: 'Success' } } }) },
    '/api/ai/context': { get: protectedOperation({ tags: ['AI Agent'], summary: 'Get AI agent context for current user', responses: { 200: { description: 'Success' } } }) },
    '/api/ai/plan': { post: protectedOperation({ tags: ['AI Agent'], summary: 'Generate workout and meal plan together', requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/BodyDataRequest' } } } }, responses: { 201: { description: 'Created' } } }) },
    '/api/ai/chat': { post: protectedOperation({ tags: ['AI Agent'], summary: 'AI agent chat endpoint', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AiChatRequest' } } } }, responses: { 200: { description: 'Success' } } }) },
    '/api/admin/attendance': { get: protectedOperation({ tags: ['Admin'], summary: 'Get attendance analytics', responses: { 200: { description: 'Success' } } }) },
    '/api/admin/revenue': { get: protectedOperation({ tags: ['Admin'], summary: 'Get revenue analytics', responses: { 200: { description: 'Success' } } }) },
    '/api/admin/machines': { get: protectedOperation({ tags: ['Admin'], summary: 'Get machine usage analytics', responses: { 200: { description: 'Success' } } }) },
    '/api/admin/users': { get: protectedOperation({ tags: ['Admin'], summary: 'Get users analytics', responses: { 200: { description: 'Success' } } }) },
    '/api/admin/crowd': { get: protectedOperation({ tags: ['Admin'], summary: 'Get crowd analytics', responses: { 200: { description: 'Success' } } }) },

    // ─── Shop ────────────────────────────────────────────────────────────────────
    '/api/shop/products': {
        get: {
            tags: ['Shop'],
            summary: 'List all products (public - no auth needed)',
            description: 'Returns all shop products with id, name, description, price, currency, image_url and stock_quantity.',
            responses: {
                200: {
                    description: 'Array of products',
                    content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'success' }, data: { type: 'array', items: { type: 'object', properties: { product_id: { type: 'integer' }, name: { type: 'string' }, description: { type: 'string', nullable: true }, price: { type: 'number' }, currency: { type: 'string', example: 'EGP' }, image_url: { type: 'string', nullable: true }, stock_quantity: { type: 'integer' } } } } } } } }
                }
            }
        }
    },

    // ─── Cart ────────────────────────────────────────────────────────────────────
    '/api/shop/cart': {
        get: protectedOperation({
            tags: ['Shop'],
            summary: 'Get current user cart',
            description: 'Returns all items in the cart with quantities, unit prices, item totals, and cart grand total.',
            responses: { 200: { description: 'Cart with items and total', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { cart_id: { type: 'integer' }, quantity: { type: 'integer' }, product_id: { type: 'integer' }, name: { type: 'string' }, description: { type: 'string', nullable: true }, price: { type: 'number' }, currency: { type: 'string' }, image_url: { type: 'string', nullable: true }, item_total: { type: 'number' } } } }, total: { type: 'number', example: 1430 }, count: { type: 'integer' } } } } } } } }
            }
        }),
        post: protectedOperation({
            tags: ['Shop'],
            summary: 'Add item to cart (or increase quantity if already exists)',
            description: 'Add a product by productId. If the product already exists in the cart its quantity is incremented.',
            requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AddToCartRequest' } } } },
            responses: { 201: { description: 'Updated cart returned' }, 400: { description: 'Out of stock or invalid input' }, 404: { description: 'Product not found' } }
        }),
        delete: protectedOperation({
            tags: ['Shop'],
            summary: 'Clear entire cart',
            description: 'Removes all items from the authenticated user\'s cart.',
            responses: { 200: { description: '{ cleared: true }' } }
        })
    },

    '/api/shop/cart/{cartId}': {
        put: protectedOperation({
            tags: ['Shop'],
            summary: 'Update cart item quantity',
            description: 'Set quantity to 0 to remove the item from the cart.',
            parameters: [{ name: 'cartId', in: 'path', required: true, schema: { type: 'integer' }, description: 'cart_id returned by GET /cart' }],
            requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateCartRequest' } } } },
            responses: { 200: { description: 'Updated cart returned' }, 404: { description: 'Cart item not found' } }
        }),
        delete: protectedOperation({
            tags: ['Shop'],
            summary: 'Remove single item from cart',
            parameters: [{ name: 'cartId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { 200: { description: 'Updated cart returned' }, 404: { description: 'Cart item not found' } }
        })
    },

    // ─── Checkout ────────────────────────────────────────────────────────────────
    '/api/shop/checkout': {
        post: protectedOperation({
            tags: ['Shop'],
            summary: 'Checkout - place order for all cart items',
            description: 'Validates stock, inserts each cart item into shop_history, deducts stock, clears the cart, and returns the purchase receipt. This is the single action that creates My Purchases.',
            requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckoutRequest' } } } },
            responses: {
                201: {
                    description: 'Purchase receipt',
                    content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', properties: { success: { type: 'boolean' }, payment_method: { type: 'string' }, payment_status: { type: 'string', example: 'paid' }, items: { type: 'array', items: { type: 'object', properties: { sh_id: { type: 'integer' }, product_id: { type: 'integer' }, name: { type: 'string' }, image_url: { type: 'string', nullable: true }, quantity: { type: 'integer' }, unit_price: { type: 'number' }, currency: { type: 'string' }, total_price: { type: 'number' }, status: { type: 'string', example: 'Completed' }, purchased_at: { type: 'string', format: 'date-time' } } } }, total: { type: 'number' }, currency: { type: 'string', example: 'EGP' } } } } } } }
                },
                400: { description: 'Cart is empty or insufficient stock' }
            }
        })
    },

    '/api/shop/history': {
        get: protectedOperation({
            tags: ['Shop'],
            summary: 'Get purchase history (My Purchases)',
            description: 'Returns all past purchases for the authenticated user.',
            responses: {
                200: { description: 'Purchase history with totalOrders, totalSpent, and items array' }
            }
        })
    },

    // ─── Payment Methods ─────────────────────────────────────────────────────────
    '/api/shop/payment-methods': {
        get: protectedOperation({
            tags: ['Shop'],
            summary: 'List saved payment methods (demo)',
            responses: { 200: { description: 'Array of payment methods' } }
        }),
        post: protectedOperation({
            tags: ['Shop'],
            summary: 'Save a new payment method (demo)',
            requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AddPaymentMethodRequest' } } } },
            responses: { 201: { description: 'Created payment method' }, 400: { description: 'Validation error' } }
        })
    },

    '/api/shop/payment-methods/{pmId}': {
        delete: protectedOperation({
            tags: ['Shop'],
            summary: 'Delete a saved payment method',
            parameters: [{ name: 'pmId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { 200: { description: '{ deleted: true }' }, 404: { description: 'Payment method not found' } }
        })
    },

    // ─── Coach Rating ─────────────────────────────────────────────────────────
    '/api/coaches/{id}/rate': {
        post: protectedOperation({
            tags: ['Coaches'],
            summary: 'Rate a coach (user only, once per 30 days)',
            description: 'Submit a rating for a coach. A user can only rate the same coach once every 30 days. Each criterion is 1-5 stars.',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Coach ID' }],
            requestBody: {
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            required: ['communication', 'knowledge', 'attitude', 'punctuality'],
                            properties: {
                                communication: { type: 'integer', minimum: 1, maximum: 5, example: 4 },
                                knowledge:     { type: 'integer', minimum: 1, maximum: 5, example: 5 },
                                attitude:      { type: 'integer', minimum: 1, maximum: 5, example: 4 },
                                punctuality:   { type: 'integer', minimum: 1, maximum: 5, example: 3 },
                                comment:       { type: 'string', example: 'Great coach, very helpful!' }
                            }
                        }
                    }
                }
            },
            responses: {
                201: { description: 'Rating saved successfully' },
                400: { description: 'Invalid star values (must be 1-5)' },
                404: { description: 'Coach not found' },
                429: { description: 'Already rated this coach - must wait 30 days' }
            }
        })
    },

    '/api/coaches/{id}/my-rating': {
        get: protectedOperation({
            tags: ['Coaches'],
            summary: 'Check if current user already rated this coach',
            description: 'Returns has_rated (bool), can_rate_at (next allowed date), and the previous rating if exists.',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { 200: { description: '{ has_rated, can_rate_at, rating }' } }
        })
    },

    '/api/coaches/{id}/ratings': {
        get: protectedOperation({
            tags: ['Coaches'],
            summary: 'Get all ratings for a coach (admin only)',
            description: 'Returns aggregated averages per criterion and the full list of individual ratings.',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { 200: { description: 'Ratings summary with averages and individual reviews' } }
        })
    },

    '/api/coaches/customers/list': {
        get: protectedOperation({
            tags: ['Coaches'],
            summary: 'Get all customers for tracking (coach only)',
            description: 'Returns a list of all active users in the system.',
            responses: { 200: { description: 'List of customers' } }
        })
    },
    '/api/coaches/customers/{userId}/attendance': {
        get: protectedOperation({
            tags: ['Coaches'],
            summary: 'Get customer attendance history (coach only)',
            description: 'Returns a list of past machine bookings for the specified user.',
            parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { 200: { description: 'List of past machine bookings' } }
        })
    },
    '/api/coaches/customers/{userId}/progress': {
        get: protectedOperation({
            tags: ['Coaches'],
            summary: 'Get customer progress report (coach only)',
            description: 'Returns the latest InBody scan summary (Weight, Body Fat %, Commitment).',
            parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { 200: { description: 'Progress report object' } }
        })
    },
    '/api/coaches/customers/{userId}/activity': {
        get: protectedOperation({
            tags: ['Coaches'],
            summary: 'Get customer activity alerts info (coach only)',
            description: 'Returns the number of days since the user last booked a machine.',
            parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { 200: { description: 'Activity summary with inactive_days' } }
        })
    },
    '/api/coaches/customers/{userId}/alert': {
        post: protectedOperation({
            tags: ['Coaches'],
            summary: 'Send an activity alert to a customer (coach only)',
            description: 'Sends a direct chat message from the coach to the user alerting them about their inactivity.',
            parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { 201: { description: 'Alert message sent successfully' } }
        })
    }
};

const setupSwagger = (app) => {
    app.get('/api/docs.json', (req, res) => {
        res.json(spec);
    });

    app.use('/api/docs/assets', express.static(swaggerAssetPath));

    const renderSwaggerUi = (req, res) => {
        res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Smart Gym API Docs</title>
  <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #f6f8fb;
    }
    #swagger-ui {
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/docs/assets/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '/api/docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: 'StandaloneLayout',
        validatorUrl: null
      });
    };
  </script>
</body>
</html>`);
    };

    app.get('/api/docs', renderSwaggerUi);
    app.get('/api/docs/', renderSwaggerUi);
};

module.exports = { setupSwagger };
