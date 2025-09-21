module.exports = {
  content: ["./**/*.html", "./**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        'dm-serif': ['DM Serif Display', 'serif'],
      },
      colors: {
        'primary-blue': '#010245',
        'accent-blue': '#4c4e9e',
        'light-blue': '#9b9bd1',
      },
      keyframes: {
        'gradient-shift': {
          '0%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
          '100%': { 'background-position': '0% 50%' },
        },
      },
      animation: {
        'gradient-shift': 'gradient-shift 20s ease infinite',
      },
      boxShadow: {
        'apple-glow': '0 0 15px rgba(1, 2, 69, 0.4)', // Custom shadow for the glow effect
        '3xl': '0 10px 30px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)', // Subtle, layered shadow for depth
        '4xl': '0 20px 40px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)', // More pronounced on hover
      },
    },
  },
  plugins: [],
}
