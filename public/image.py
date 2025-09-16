from PIL import Image
import os

# Print the current working directory to see where the script is being run from
print(f"Current working directory: {os.getcwd()}")

def create_favicons(original_image_path="logo_original.png"):
    """
    Crops the non-black parts of an image, makes it square,
    and resizes it to standard favicon sizes.
    """
    favicon_sizes = [16, 128]
    output_dir = os.path.dirname(original_image_path)

    try:
        # Open the original image
        with Image.open(original_image_path) as img:
            # Ensure the image has an alpha channel for transparency
            img = img.convert("RGBA")
            # Get the bounding box of the non-black areas
            bbox = img.getbbox()

            if not bbox:
                print("Could not find any content in the image.")
                return

            # Crop the image to the bounding box
            cropped_logo = img.crop(bbox)

            # Create a new square canvas with a transparent background
            # The size of the canvas will be the largest dimension of the cropped logo
            max_dim = max(cropped_logo.width, cropped_logo.height)
            square_canvas = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))

            # Calculate the position to paste the logo so it's centered
            paste_x = (max_dim - cropped_logo.width) // 2
            paste_y = (max_dim - cropped_logo.height) // 2

            # Paste the cropped logo onto the square canvas
            square_canvas.paste(cropped_logo, (paste_x, paste_y))

            # Loop through the desired favicon sizes and save them
            for size in favicon_sizes:
                # Resize the square logo using a high-quality downsampling filter
                favicon = square_canvas.resize((size, size), Image.Resampling.LANCZOS)
                
                output_filename = f"favicon-{size}x{size}.png"
                output_path = os.path.join(output_dir, output_filename)
                
                favicon.save(output_path)
                print(f"Successfully created {output_path}")

    except FileNotFoundError:
        print(f"Error: The file '{original_image_path}' was not found.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    # Assuming 'logo_original.png' is in the same directory as the script
    create_favicons()