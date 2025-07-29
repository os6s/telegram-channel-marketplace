# Contributing to Telegram Channel Marketplace

Thank you for your interest in contributing to the Telegram Channel Marketplace! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Bugs
1. Check if the bug has already been reported in [Issues](https://github.com/yourusername/telegram-channel-marketplace/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, Node.js version, etc.)

### Suggesting Features
1. Check [existing feature requests](https://github.com/yourusername/telegram-channel-marketplace/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)
2. Create a new issue with the "enhancement" label
3. Describe the feature and its benefits
4. Provide mockups or examples if possible

### Code Contributions

#### Prerequisites
- Node.js 18+
- PostgreSQL
- Git
- Familiarity with TypeScript, React, and Express.js

#### Development Setup
1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/telegram-channel-marketplace.git
   cd telegram-channel-marketplace
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```
5. Start development server:
   ```bash
   npm run dev
   ```

#### Making Changes
1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes following our coding standards
3. Test your changes thoroughly
4. Commit with clear messages:
   ```bash
   git commit -m "feat: add channel verification system"
   ```
5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
6. Create a Pull Request

## 📝 Coding Standards

### TypeScript Guidelines
- Use strict TypeScript configuration
- Define proper types and interfaces
- Avoid `any` type - use proper typing
- Use Zod schemas for validation
- Document complex functions with JSDoc

### React Guidelines
- Use functional components with hooks
- Follow React best practices
- Use proper state management
- Implement error boundaries
- Optimize re-renders with useMemo/useCallback

### Backend Guidelines
- Use proper error handling
- Implement input validation
- Follow RESTful API principles
- Use proper HTTP status codes
- Add proper authentication checks

### Code Style
- Use Prettier for code formatting
- Follow ESLint rules
- Use meaningful variable names
- Keep functions small and focused
- Add comments for complex logic

### Database Guidelines
- Use Drizzle ORM for database operations
- Write proper migrations
- Use transactions for complex operations
- Implement proper indexing
- Follow database naming conventions

## 🧪 Testing

### Running Tests
```bash
# Type checking
npm run check

# Linting
npm run lint

# Tests (when available)
npm test
```

### Writing Tests
- Write unit tests for utility functions
- Add integration tests for API endpoints
- Test React components with React Testing Library
- Mock external dependencies properly

## 📋 Pull Request Guidelines

### Before Submitting
- [ ] Code follows project conventions
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Documentation updated if needed
- [ ] Changes are backwards compatible

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Additional Notes
Any additional information
```

## 🏗️ Project Architecture

### Frontend Structure
```
client/src/
├── components/     # Reusable UI components
├── pages/         # Application pages
├── contexts/      # React contexts
├── hooks/         # Custom React hooks
├── lib/           # Utility functions
└── types/         # TypeScript type definitions
```

### Backend Structure
```
server/
├── index.ts       # Server entry point
├── routes.ts      # API routes
├── storage.ts     # Database operations
├── telegram-bot.ts # Bot integration
└── middleware/    # Express middleware
```

### Database Schema
- Users table for authentication
- Channels table for listings
- Escrows table for transactions
- Proper foreign key relationships

## 🚀 Deployment

### Development
- Uses in-memory storage for quick testing
- Hot reload for frontend and backend
- Mock data for development

### Production
- PostgreSQL database required
- Environment variables properly configured
- Build process optimized for production

## 🔒 Security Considerations

### Authentication
- Telegram WebApp integration
- JWT tokens for session management
- Proper authorization checks

### Data Validation
- Server-side validation with Zod
- Client-side validation for UX
- SQL injection prevention
- XSS protection

### API Security
- Rate limiting implementation
- CORS configuration
- Input sanitization
- Error message security

## 📚 Resources

### Documentation
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [TON Documentation](https://ton.org/docs/)
- [React Documentation](https://react.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)

### Tools
- [shadcn/ui Components](https://ui.shadcn.com/)
- [TailwindCSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)

## 🆘 Getting Help

- **Discord**: Join our development Discord
- **Issues**: Create a GitHub issue
- **Discussions**: Use GitHub Discussions
- **Email**: Contact maintainers directly

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Annual contributor appreciation

Thank you for contributing to the Telegram Channel Marketplace! 🎉