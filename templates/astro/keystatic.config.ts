import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      path: 'src/content/posts/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        content: fields.markdoc({
          label: 'Content',
          options: {
            image: {
              directory: 'src/assets/images/posts',
              publicPath: '../../assets/images/posts/',
            },
          },
        }),
      },
    }),
    images: collection({
      label: 'Images',
      slugField: 'title',
      path: 'src/content/images/*',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        alt: fields.text({ label: 'Alt Text' }),
        image: fields.image({
          label: 'Image',
          directory: 'src/content/images',
        }),
        tags: fields.array(
          fields.text({ label: 'Tag' }),
          { label: 'Tags', itemLabel: (props) => props.value }
        ),
      },
    }),
    videos: collection({
      label: 'Videos',
      slugField: 'title',
      path: 'src/content/videos/*',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        video: fields.file({
          label: 'Video File',
          directory: 'src/content/videos',
        }),
        poster: fields.image({
          label: 'Poster/Thumbnail',
          directory: 'src/content/videos/posters',
        }),
        duration: fields.number({ label: 'Duration (seconds)' }),
        tags: fields.array(
          fields.text({ label: 'Tag' }),
          { label: 'Tags', itemLabel: (props) => props.value }
        ),
      },
    }),
  },
});
