# Smart Gym AI

An AI-powered gym management platform that helps athletes, coaches, and administrators manage training, track performance, and receive intelligent fitness recommendations.

## Overview

Smart Gym AI is a full-stack web application designed to improve gym operations and athlete performance through data-driven insights and AI-assisted recommendations.

The platform supports multiple user roles and provides personalized workout plans, performance tracking, health monitoring, and administrative management tools.

---

## Features

### Athlete Portal
- Personalized dashboard
- Workout plan management
- Progress tracking
- Health metrics monitoring
- AI-powered workout recommendations

### Coach Portal
- Manage athletes
- Create and assign workout programs
- Monitor athlete performance
- Review training analytics

### Admin Portal
- User management
- Gym operations management
- Reports and analytics
- System monitoring

### AI Capabilities
- Personalized workout recommendations
- Performance analysis
- Training optimization suggestions
- Risk detection and fitness insights

---

## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript

### Backend
- Node.js
- Express.js

### Database
- MySQL
- SQL Server

### Authentication
- JWT
- bcrypt

### Development Tools
- Git
- GitHub
- Postman

---

## System Architecture

Client → Express API → Business Logic → Database

Authentication is handled using JWT tokens and password hashing with bcrypt.

---

## Project Structure

```text
Smart-Gym-AI/
│
├── controllers/
├── models/
├── routes/
├── middleware/
├── services/
├── database/
├── public/
├── views/
└── server.js
