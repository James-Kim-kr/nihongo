import React from 'react';
import Link from 'next/link';

const Header: React.FC = () => {
    return (
        <header>
            <h1>My Personal Blog</h1>
            <nav>
                <ul>
                    <li>
                        <Link href="/">Home</Link>
                    </li>
                    <li>
                        <Link href="/about">About</Link>
                    </li>
                    <li>
                        <Link href="/jlpt-flashcards">JLPT Flashcards</Link>
                    </li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;