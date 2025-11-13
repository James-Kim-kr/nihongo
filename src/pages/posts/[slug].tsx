import { GetStaticPaths, GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import type { ParsedUrlQuery } from 'querystring';
import { getPostBySlug, getAllPosts, type Post as PostData } from '../../lib/posts';
import React from 'react';

interface PostPageProps {
  post: PostData;
}

interface PostParams extends ParsedUrlQuery {
  slug: string;
}

const Post: React.FC<PostPageProps> = ({ post }) => {
  const router = useRouter();

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
};

export const getStaticPaths: GetStaticPaths<PostParams> = async () => {
  const posts = await getAllPosts();
  const paths = posts.map(post => ({
    params: { slug: post.slug },
  }));

  return { paths, fallback: true };
};

export const getStaticProps: GetStaticProps<PostPageProps, PostParams> = async ({ params }) => {
  if (!params?.slug) {
    return { notFound: true };
  }

  const post = await getPostBySlug(params.slug);

  return {
    props: {
      post,
    },
  };
};

export default Post;
