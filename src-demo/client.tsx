import { useEffect, useState } from 'react';
import { render } from 'react-dom';
import { spotify, isUnauthorized } from '../src-client';

const spotifyClient = spotify();

function App() {
  const [me, setMe] = useState<
    null | Error | SpotifyApi.CurrentUsersProfileResponse | 'unauthorized'
  >(null);
  useEffect(() => {
    spotifyClient.me().then(setMe, (err) => {
      setMe(
        isUnauthorized(err)
          ? 'unauthorized'
          : err instanceof Error
          ? err
          : new Error(err),
      );
    });
  }, []);

  return (
    <>
      <h1>Hello</h1>
      {me instanceof Error ? (
        <p>Error: {me.message}</p>
      ) : me === 'unauthorized' ? (
        <button onClick={() => spotifyClient.login()}>Login</button>
      ) : me === null ? (
        <p>Loading...</p>
      ) : (
        <h3>{me.display_name}</h3>
      )}
    </>
  );
}

render(<App />, document.getElementById('app'));
