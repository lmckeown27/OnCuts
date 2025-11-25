# Contributing to CampusCuts

Thank you for your interest in contributing to CampusCuts! This document provides guidelines and instructions for contributing.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing](#testing)
6. [Pull Request Process](#pull-request-process)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Maintain professional communication

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Aptos CLI
- Xcode 15+ (for iOS development)
- Docker (optional, for local development)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/lmckeown27/CampusCuts.git
   cd CampusCuts
   ```

2. Run setup script:
   ```bash
   make setup
   ```

3. Configure environment:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your credentials
   ```

4. Start development environment:
   ```bash
   make start
   ```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates

Example: `feature/add-chat-functionality`

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

Examples:
```
feat(booking): add instant book functionality
fix(payment): resolve Stripe webhook timeout
docs(api): update endpoint documentation
```

## Coding Standards

### TypeScript/JavaScript (Backend)

- Use TypeScript strict mode
- Follow ESLint configuration
- Use async/await (avoid callbacks)
- Prefer functional programming patterns
- Write self-documenting code with clear variable names
- Add JSDoc comments for public APIs

### Swift (iOS)

- Follow Swift API Design Guidelines
- Use SwiftLint for code style
- Prefer value types over reference types
- Use descriptive variable names
- Add documentation comments for public interfaces

### Move (Smart Contracts)

- Follow Move coding conventions
- Use descriptive function names
- Add comprehensive tests
- Document all public functions
- Consider gas optimization

## Testing

### Smart Contracts

```bash
cd contracts
aptos move test
```

### Backend

```bash
cd backend
npm test
npm run lint
```

### iOS

```bash
cd ios-app
xcodebuild test -scheme CampusCuts
```

### Run All Tests

```bash
make test
```

## Pull Request Process

1. **Create a feature branch** from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following coding standards

3. **Write/update tests** for your changes

4. **Run tests** locally
   ```bash
   make test
   ```

5. **Commit your changes** using conventional commits

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create Pull Request**:
   - Provide clear title and description
   - Reference related issues
   - Include screenshots for UI changes
   - Ensure CI passes

8. **Code Review**:
   - Address review comments
   - Keep PR updated with main branch
   - Squash commits if requested

9. **Merge**:
   - Maintainers will merge after approval
   - Delete your feature branch after merge

## Project Structure

```
CampusCuts/
├── contracts/           # Aptos Move smart contracts
├── ios-app/            # iOS SwiftUI application
├── backend/            # Node.js/TypeScript API
├── docs/               # Documentation
└── scripts/            # Utility scripts
```

## Areas for Contribution

### High Priority

- [ ] Implement real-time chat functionality
- [ ] Add map-based barber discovery
- [ ] Build Android app
- [ ] Enhance analytics dashboard
- [ ] Add AI-powered barber recommendations

### Medium Priority

- [ ] Implement referral system
- [ ] Add social sharing features
- [ ] Build admin dashboard
- [ ] Create marketing website
- [ ] Add multi-language support

### Good First Issues

- [ ] Improve error messages
- [ ] Add loading states
- [ ] Write documentation
- [ ] Fix UI/UX issues
- [ ] Add unit tests

## Questions?

- Open an issue for bugs or feature requests
- Join our Discord community (link TBD)
- Email: dev@campuscuts.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to CampusCuts! 🎉

