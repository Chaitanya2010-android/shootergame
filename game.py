import pygame
import random
import sys

# Initialize pygame
pygame.init()

# Screen setup
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Simple 2D Shooter")

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED   = (255, 0, 0)

# Player setup
player_size = 50
player = pygame.Rect(WIDTH//2, HEIGHT-60, player_size, player_size)
player_speed = 5

# Bullet setup
bullets = []
bullet_speed = -7

# Enemy setup
enemies = []
enemy_size = 40
enemy_speed = 2

clock = pygame.time.Clock()

def spawn_enemy():
    x = random.randint(0, WIDTH-enemy_size)
    y = random.randint(0, HEIGHT//2)
    enemies.append(pygame.Rect(x, y, enemy_size, enemy_size))

# Game loop
while True:
    screen.fill(BLACK)

    # Event handling
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_SPACE:  # Shoot
                bullets.append(pygame.Rect(player.centerx-5, player.top, 10, 20))

    # Player movement
    keys = pygame.key.get_pressed()
    if keys[pygame.K_LEFT] and player.left > 0:
        player.x -= player_speed
    if keys[pygame.K_RIGHT] and player.right < WIDTH:
        player.x += player_speed

    # Update bullets
    for bullet in bullets[:]:
        bullet.y += bullet_speed
        if bullet.bottom < 0:
            bullets.remove(bullet)

    # Spawn enemies randomly
    if random.randint(1, 50) == 1:
        spawn_enemy()

    # Update enemies
    for enemy in enemies[:]:
        enemy.y += enemy_speed
        if enemy.top > HEIGHT:
            enemies.remove(enemy)

    # Collision detection
    for bullet in bullets[:]:
        for enemy in enemies[:]:
            if bullet.colliderect(enemy):
                bullets.remove(bullet)
                enemies.remove(enemy)
                break

    # Draw everything
    pygame.draw.rect(screen, WHITE, player)
    for bullet in bullets:
        pygame.draw.rect(screen, RED, bullet)
    for enemy in enemies:
        pygame.draw.rect(screen, WHITE, enemy)

    pygame.display.flip()
    clock.tick(60)
