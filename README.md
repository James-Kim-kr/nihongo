# Personal Blog

Welcome to the Personal Blog project! This blog is designed to share resources, insights, and personal reflections. Below are the details on how to set up and use the blog.

## Project Structure

The project is organized as follows:

```
personal-blog
├── src
│   ├── pages
│   │   ├── index.tsx        # Main entry point for the blog
│   │   ├── about.tsx        # About page
│   │   └── posts
│   │       └── [slug].tsx   # Dynamic route for individual posts
│   ├── components
│   │   ├── Header.tsx       # Header component
│   │   ├── Footer.tsx       # Footer component
│   │   └── PostCard.tsx     # Component for displaying post summaries
│   ├── styles
│   │   ├── globals.css       # Global styles
│   │   └── components.css    # Component-specific styles
│   └── lib
│       └── posts.ts         # Functions for managing blog posts
├── content
│   └── posts
│       └── example-post.md   # Sample blog post in markdown
├── public
│   └── robots.txt           # Instructions for web crawlers
├── package.json              # npm configuration
├── tsconfig.json             # TypeScript configuration
├── next.config.js            # Next.js configuration
├── .gitignore                # Files to ignore in version control
└── README.md                 # Project documentation
```

## Getting Started

To get started with the Personal Blog, follow these steps:

1. **Clone the Repository**: 
   ```
   git clone <repository-url>
   cd personal-blog
   ```

2. **Install Dependencies**: 
   ```
   npm install
   ```

3. **Run the Development Server**: 
   ```
   npm run dev
   ```

4. **Open in Browser**: 
   Navigate to `http://localhost:3000` to view the blog.

## Features

- **Homepage**: Lists recent posts and provides navigation to other sections.
- **About Page**: Offers information about the blog's purpose and the author.
- **Dynamic Post Pages**: Each blog post can be accessed via a unique URL based on its slug.
- **Responsive Design**: The blog is designed to be accessible on various devices.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.

Happy blogging!