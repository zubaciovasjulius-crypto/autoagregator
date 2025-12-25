import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PublishRequest {
  platform: 'facebook' | 'instagram';
  message: string;
  imageUrl?: string;
  linkUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    const FACEBOOK_PAGE_ID = Deno.env.get('FACEBOOK_PAGE_ID');
    const INSTAGRAM_ACCOUNT_ID = Deno.env.get('INSTAGRAM_ACCOUNT_ID');

    // Check if secrets are configured
    if (!META_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'META_ACCESS_TOKEN nėra sukonfigūruotas',
          needsSetup: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const body: PublishRequest = await req.json();
    const { platform, message, imageUrl, linkUrl } = body;

    console.log(`Publishing to ${platform}:`, { message, imageUrl, linkUrl });

    if (platform === 'facebook') {
      if (!FACEBOOK_PAGE_ID) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'FACEBOOK_PAGE_ID nėra sukonfigūruotas',
            needsSetup: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      let result;
      
      if (imageUrl) {
        // Post with photo
        console.log('Posting photo to Facebook...');
        const response = await fetch(
          `https://graph.facebook.com/v19.0/${FACEBOOK_PAGE_ID}/photos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: imageUrl,
              message: message,
              access_token: META_ACCESS_TOKEN,
            }),
          }
        );
        result = await response.json();
      } else {
        // Post with link or just text
        console.log('Posting feed to Facebook...');
        const postData: Record<string, string> = {
          message: message,
          access_token: META_ACCESS_TOKEN,
        };
        
        if (linkUrl) {
          postData.link = linkUrl;
        }

        const response = await fetch(
          `https://graph.facebook.com/v19.0/${FACEBOOK_PAGE_ID}/feed`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData),
          }
        );
        result = await response.json();
      }

      console.log('Facebook API response:', result);

      if (result.error) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: result.error.message || 'Facebook API klaida',
            details: result.error
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          platform: 'facebook',
          postId: result.id || result.post_id,
          message: 'Sėkmingai publikuota į Facebook!' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (platform === 'instagram') {
      if (!INSTAGRAM_ACCOUNT_ID) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'INSTAGRAM_ACCOUNT_ID nėra sukonfigūruotas',
            needsSetup: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      if (!imageUrl) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Instagram reikalauja nuotraukos' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Step 1: Create media container
      console.log('Creating Instagram media container...');
      const containerResponse = await fetch(
        `https://graph.facebook.com/v19.0/${INSTAGRAM_ACCOUNT_ID}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            caption: message,
            access_token: META_ACCESS_TOKEN,
          }),
        }
      );
      const containerResult = await containerResponse.json();
      
      console.log('Container result:', containerResult);

      if (containerResult.error) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: containerResult.error.message || 'Instagram container klaida',
            details: containerResult.error
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const creationId = containerResult.id;

      // Step 2: Publish the container
      console.log('Publishing Instagram media...');
      const publishResponse = await fetch(
        `https://graph.facebook.com/v19.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: creationId,
            access_token: META_ACCESS_TOKEN,
          }),
        }
      );
      const publishResult = await publishResponse.json();

      console.log('Publish result:', publishResult);

      if (publishResult.error) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: publishResult.error.message || 'Instagram publish klaida',
            details: publishResult.error
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          platform: 'instagram',
          postId: publishResult.id,
          message: 'Sėkmingai publikuota į Instagram!' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Nežinoma platforma' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Nežinoma klaida';
    console.error('Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
