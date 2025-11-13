import React from 'react';
import { Post } from '../lib/posts';

interface PostCardProps {
    post: Post;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
    return (
        <div className="post-card">
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
            <a href={`/posts/${post.slug}`} className="read-more">Read More</a>
        </div>
    );
};

export default PostCard;
